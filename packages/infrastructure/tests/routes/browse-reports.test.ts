import { Request, Response } from 'express';
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
    // Reset mocks
    jest.clearAllMocks();

    // Mock response object
    mockSendResponse = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockContentType = jest.fn().mockReturnThis();
    mockRes = {
      status: mockStatus,
      send: mockSendResponse,
      contentType: mockContentType
    };

    // Mock request object
    mockReq = {
      query: {
        environment: 'test'
      }
    };
  });

  describe('Successful response', () => {
    it('should return HTML with grouped reports', async () => {
      // Mock S3 response with report files
      const mockS3Response = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567890/desktop/index.html' },
          { Key: 'reports/project1/prod/main/1234567891/mobile/index.html' },
          { Key: 'reports/project2/staging/feature/1234567892/desktop/index.html' },
          { Key: 'reports/project1/prod/main/1234567893/desktop/pages/some-page.html' }, // Should be ignored (contains "pages")
          { Key: 'reports/project1/prod/main/1234567894/desktop/report.json' } // Should be ignored (not index.html)
        ],
        IsTruncated: false
      };

      mockSend.mockResolvedValue(mockS3Response);

      // Mock utility function responses
      mockGetTaskParametersFromReportPath
        .mockReturnValueOnce({
          projectName: 'project1',
          environment: 'prod',
          variantName: 'desktop',
          timestamp: 1234567890,
          gitBranchOrTag: 'main'
        })
        .mockReturnValueOnce({
          projectName: 'project1',
          environment: 'prod',
          variantName: 'mobile',
          timestamp: 1234567891,
          gitBranchOrTag: 'main'
        })
        .mockReturnValueOnce({
          projectName: 'project2',
          environment: 'staging',
          variantName: 'desktop',
          timestamp: 1234567892,
          gitBranchOrTag: 'feature'
        });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockSend).toHaveBeenCalled();

      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledTimes(3);
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project1/prod/main/1234567890/desktop/index.html');
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project1/prod/main/1234567891/mobile/index.html');
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project2/staging/feature/1234567892/desktop/index.html');

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockContentType).toHaveBeenCalledWith('text/html');
      expect(mockSendResponse).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
      expect(mockSendResponse).toHaveBeenCalledWith(expect.stringContaining('project1'));
      expect(mockSendResponse).toHaveBeenCalledWith(expect.stringContaining('project2'));
      expect(mockSendResponse).toHaveBeenCalledWith(expect.stringContaining('desktop'));
      expect(mockSendResponse).toHaveBeenCalledWith(expect.stringContaining('mobile'));
    });

    it('should handle empty S3 response', async () => {
      mockSend.mockResolvedValue({
        Contents: [],
        IsTruncated: false
      });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockContentType).toHaveBeenCalledWith('text/html');
      expect(mockSendResponse).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
      expect(mockGetTaskParametersFromReportPath).not.toHaveBeenCalled();
    });

    it('should handle pagination with IsTruncated=true', async () => {
      // First call returns truncated results
      const firstResponse = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567890/desktop/index.html' }
        ],
        IsTruncated: true,
        NextContinuationToken: 'next-token'
      };

      // Second call returns remaining results
      const secondResponse = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567891/mobile/index.html' }
        ],
        IsTruncated: false
      };

      mockSend
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      mockGetTaskParametersFromReportPath
        .mockReturnValueOnce({
          projectName: 'project1',
          environment: 'prod',
          variantName: 'desktop',
          timestamp: 1234567890,
          gitBranchOrTag: 'main'
        })
        .mockReturnValueOnce({
          projectName: 'project1',
          environment: 'prod',
          variantName: 'mobile',
          timestamp: 1234567891,
          gitBranchOrTag: 'main'
        });

      await browseReportsHandler(mockReq, mockRes as Response);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should filter out non-index.html files and pages directory', async () => {
      const mockS3Response = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567890/desktop/index.html' }, // Should be included
          { Key: 'reports/project1/prod/main/1234567890/desktop/report.json' }, // Should be excluded
          { Key: 'reports/project1/prod/main/1234567890/desktop/pages/index.html' }, // Should be excluded (pages dir)
          { Key: 'reports/project1/prod/main/1234567890/desktop/other.html' } // Should be excluded (not index.html)
        ],
        IsTruncated: false
      };

      mockSend.mockResolvedValue(mockS3Response);

      mockGetTaskParametersFromReportPath.mockReturnValue({
        projectName: 'project1',
        environment: 'prod',
        variantName: 'desktop',
        timestamp: 1234567890,
        gitBranchOrTag: 'main'
      });

      await browseReportsHandler(mockReq, mockRes as Response);

      // Should only call getTaskParametersFromReportPath once for the valid index.html file
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledTimes(1);
      expect(mockGetTaskParametersFromReportPath).toHaveBeenCalledWith('reports/project1/prod/main/1234567890/desktop/index.html');
    });
  });

  describe('Error handling', () => {
    it('should handle S3 errors gracefully and return empty report list', async () => {
      mockSend.mockRejectedValue(new Error('S3 service error'));

      await browseReportsHandler(mockReq, mockRes as Response);

      // The listHtmlFiles function catches S3 errors and returns empty array,
      // so the handler continues and returns 200 with empty content
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockContentType).toHaveBeenCalledWith('text/html');
      expect(mockSendResponse).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
      expect(mockGetTaskParametersFromReportPath).not.toHaveBeenCalled();
    });

    it('should handle utility function errors gracefully', async () => {
      const mockS3Response = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567890/desktop/index.html' }
        ],
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

  describe('HTML output validation', () => {
    it('should generate valid HTML structure with reports', async () => {
      const mockS3Response = {
        Contents: [
          { Key: 'reports/project1/prod/main/1234567890/desktop/index.html' }
        ],
        IsTruncated: false
      };

      mockSend.mockResolvedValue(mockS3Response);
      mockGetTaskParametersFromReportPath.mockReturnValue({
        projectName: 'project1',
        environment: 'prod',
        variantName: 'desktop',
        timestamp: 1234567890,
        gitBranchOrTag: 'main'
      });

      await browseReportsHandler(mockReq, mockRes as Response);

      const htmlContent = mockSendResponse.mock.calls[0][0];
      
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html lang="en">');
      expect(htmlContent).toContain('<title>Performance Reports</title>');
      expect(htmlContent).toContain('<h1>Performance Reports</h1>');
      expect(htmlContent).toContain('<h2>project1</h2>');
      expect(htmlContent).toContain('<h3>prod</h3>');
      expect(htmlContent).toContain('<h4>desktop</h4>');
      expect(htmlContent).toContain(`${process.env.STATIC_REPORT_BASE_URL}reports/project1/prod/main/1234567890/desktop/index.html`);
    });
  });
});