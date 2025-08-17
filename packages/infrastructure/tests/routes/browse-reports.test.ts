import { Response } from 'express';
import { browseReportsHandler } from '../../lib/lambda/public-api/routes/browse-reports';

// Mock the S3 client
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    ListObjectsV2Command: jest.fn().mockImplementation((params) => params),
    __mockSend: mockSend,
  };
});

// Get the mocked function
const { __mockSend: mockSend } = jest.requireMock('@aws-sdk/client-s3');

// Mock utils
jest.mock('../../lib/utils/utils', () => ({
  getTaskParametersFromReportPath: jest.fn()
}));

import { getTaskParametersFromReportPath } from '../../lib/utils/utils';
const mockGetTaskParametersFromReportPath = getTaskParametersFromReportPath as jest.MockedFunction<typeof getTaskParametersFromReportPath>;

describe('GET /api/browse-reports', () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let mockSendResponse: jest.Mock;
  let mockStatus: jest.Mock;
  let mockContentType: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSendResponse = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockContentType = jest.fn().mockReturnThis();
    mockRes = {
      status: mockStatus,
      send: mockSendResponse,
      contentType: mockContentType
    } as any;

    mockReq = { query: { environment: 'test' } } as any;
  });

  describe('Successful response', () => {
    it('should return JSON with grouped reports', async () => {
      const mockS3Response = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567890/desktop/index.html' },
          { Key: 'reports/project1/prod/main/1234567891/mobile/index.html' },
          { Key: 'reports/project2/staging/feature/1234567892/desktop/index.html' },
          { Key: 'reports/project1/prod/main/1234567893/desktop/pages/some-page.html' },
          { Key: 'reports/project1/prod/main/1234567894/desktop/report.json' }
        ],
        IsTruncated: false
      };

      mockSend.mockResolvedValue(mockS3Response);

      mockGetTaskParametersFromReportPath
        .mockReturnValueOnce({
          projectName: 'project1', environment: 'prod', variantName: 'desktop', timestamp: 1234567890, gitBranchOrTag: 'main'
        })
        .mockReturnValueOnce({
          projectName: 'project1', environment: 'prod', variantName: 'mobile', timestamp: 1234567891, gitBranchOrTag: 'main'
        })
        .mockReturnValueOnce({
          projectName: 'project2', environment: 'staging', variantName: 'desktop', timestamp: 1234567892, gitBranchOrTag: 'feature'
        });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockSend).toHaveBeenCalled();
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledTimes(3);
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project1/prod/main/1234567890/desktop/index.html');
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project1/prod/main/1234567891/mobile/index.html');
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project2/staging/feature/1234567892/desktop/index.html');

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockContentType).toHaveBeenCalledWith('json');

      const payload = mockSendResponse.mock.calls[0][0];
      expect(payload).toEqual({
        project1: {
          prod: {
            desktop: [
              {
                environment: 'prod', projectName: 'project1', variantName: 'desktop', date: expect.any(String),
                path: 'reports/project1/prod/main/1234567890/desktop/index.html'
              }
            ],
            mobile: [
              {
                environment: 'prod', projectName: 'project1', variantName: 'mobile', date: expect.any(String),
                path: 'reports/project1/prod/main/1234567891/mobile/index.html'
              }
            ]
          }
        },
        project2: {
          staging: {
            desktop: [
              {
                environment: 'staging', projectName: 'project2', variantName: 'desktop', date: expect.any(String),
                path: 'reports/project2/staging/feature/1234567892/desktop/index.html'
              }
            ]
          }
        }
      });
    });

    it('should handle empty S3 response', async () => {
      mockSend.mockResolvedValue({ Contents: [], IsTruncated: false });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockContentType).toHaveBeenCalledWith('json');
      expect(mockSendResponse).toHaveBeenCalledWith({});
      expect(mockGetTaskParametersFromReportPath).not.toHaveBeenCalled();
    });

    it('should handle pagination with IsTruncated=true', async () => {
      const firstResponse = {
        Contents: [{ Key: 'reports/project1/prod/main/1234567890/desktop/index.html' }],
        IsTruncated: true,
        NextContinuationToken: 'next-token'
      };
      const secondResponse = {
        Contents: [{ Key: 'reports/project1/prod/main/1234567891/mobile/index.html' }],
        IsTruncated: false
      };

      mockSend
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      mockGetTaskParametersFromReportPath
        .mockReturnValueOnce({ projectName: 'project1', environment: 'prod', variantName: 'desktop', timestamp: 1234567890, gitBranchOrTag: 'main' })
        .mockReturnValueOnce({ projectName: 'project1', environment: 'prod', variantName: 'mobile', timestamp: 1234567891, gitBranchOrTag: 'main' });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockContentType).toHaveBeenCalledWith('json');
    });

    it('should filter out non-index.html files and pages directory', async () => {
      const mockS3Response = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567890/desktop/index.html' },
          { Key: 'reports/project1/prod/main/1234567890/desktop/report.json' },
          { Key: 'reports/project1/prod/main/1234567890/desktop/pages/index.html' },
          { Key: 'reports/project1/prod/main/1234567890/desktop/other.html' }
        ],
        IsTruncated: false
      };

      mockSend.mockResolvedValue(mockS3Response);
      mockGetTaskParametersFromReportPath.mockReturnValue({
        projectName: 'project1', environment: 'prod', variantName: 'desktop', timestamp: 1234567890, gitBranchOrTag: 'main'
      });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledTimes(1);
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project1/prod/main/1234567890/desktop/index.html');
      expect(mockContentType).toHaveBeenCalledWith('json');
    });
  });

  describe('Error handling', () => {
    it('should handle S3 errors gracefully and return empty grouped object', async () => {
      mockSend.mockRejectedValue(new Error('S3 service error'));

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockContentType).toHaveBeenCalledWith('json');
      expect(mockSendResponse).toHaveBeenCalledWith({});
      expect(mockGetTaskParametersFromReportPath).not.toHaveBeenCalled();
    });

    it('should handle utility function errors gracefully', async () => {
      const mockS3Response = {
        Contents: [{ Key: 'reports/project1/prod/main/1234567890/desktop/index.html' }],
        IsTruncated: false
      };

      mockSend.mockResolvedValue(mockS3Response);
      mockGetTaskParametersFromReportPath.mockImplementation(() => {
        throw new Error('Parse error');
      });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockContentType).toHaveBeenCalledWith('text/html');
      expect(mockSendResponse).toHaveBeenCalledWith('<h1>Error retrieving reports</h1><p>Please try again later.</p>');
    });
  });
});