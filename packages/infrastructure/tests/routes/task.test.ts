import { Request, Response } from 'express';
import { SFN, ExecutionStatus } from '@aws-sdk/client-sfn';
import { postTask } from '../../lib/lambda/public-api/routes/task';

// Mock the SFN constructor with methods
jest.mock('@aws-sdk/client-sfn', () => {
  const mockListExecutions = jest.fn();
  const mockStartExecution = jest.fn();
  
  return {
    SFN: jest.fn().mockImplementation(() => ({
      listExecutions: mockListExecutions,
      startExecution: mockStartExecution,
    })),
    ExecutionStatus: {
      RUNNING: 'RUNNING'
    },
    // Export the mocks so we can access them in tests
    __mockListExecutions: mockListExecutions,
    __mockStartExecution: mockStartExecution,
  };
});

// Get the mocked functions
const { __mockListExecutions: mockListExecutions, __mockStartExecution: mockStartExecution } = jest.requireMock('@aws-sdk/client-sfn');

describe('POST /api/task', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock response object
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
  });

  describe('Validation', () => {
    it('should return 400 for missing required fields', async () => {
      mockReq = {
        body: {
          projectName: 'test-project'
          // Missing required fields
        }
      };

      await postTask(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.any(Object)
      });
    });

    it('should return 400 for invalid browser enum', async () => {
      mockReq = {
        body: {
          projectName: 'test-project',
          baseUrl: 'https://example.com',
          environment: 'production',
          variants: [{
            variantName: 'desktop',
            urls: ['https://example.com/page1'],
            iterations: 3,
            browser: 'invalid-browser' // Invalid browser
          }]
        }
      };

      await postTask(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.any(Object)
      });
    });

    it('should return 400 for non-unique variant names', async () => {
      mockReq = {
        body: {
          projectName: 'test-project',
          baseUrl: 'https://example.com',
          environment: 'production',
          variants: [
            {
              variantName: 'desktop', // Duplicate name
              urls: ['https://example.com/page1'],
              iterations: 3,
              browser: 'chrome'
            },
            {
              variantName: 'desktop', // Duplicate name
              urls: ['https://example.com/page2'],
              iterations: 5,
              browser: 'firefox'
            }
          ]
        }
      };

      await postTask(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: expect.any(Object)
      });
    });
  });

  describe('Successful execution', () => {
    it('should accept all variants when no duplicates exist', async () => {
      mockReq = {
        body: {
          projectName: 'test-project',
          baseUrl: 'https://example.com',
          environment: 'production',
          variants: [
            {
              variantName: 'desktop',
              urls: ['https://example.com/page1'],
              iterations: 3,
              browser: 'chrome'
            },
            {
              variantName: 'mobile',
              urls: ['https://example.com/page2'],
              iterations: 5,
              browser: 'firefox'
            }
          ]
        }
      };

      // Mock no running executions
      mockListExecutions.mockResolvedValue({
        executions: []
      });

      // Mock successful execution start
      mockStartExecution.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test:execution-id',
        startDate: new Date()
      });

      await postTask(mockReq as Request, mockRes as Response);

      expect(mockListExecutions).toHaveBeenCalledWith({
        stateMachineArn: process.env.STATE_MACHINE_ARN,
        statusFilter: 'RUNNING'
      });

      expect(mockStartExecution).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        status: 'Task processing completed',
        summary: {
          totalVariants: 2,
          acceptedCount: 2,
          rejectedCount: 0
        },
        acceptedExecutions: expect.arrayContaining([
          expect.objectContaining({
            variantName: 'desktop',
            browser: 'chrome',
            executionId: expect.any(String)
          }),
          expect.objectContaining({
            variantName: 'mobile',
            browser: 'firefox',
            executionId: expect.any(String)
          })
        ]),
        rejectedExecutions: []
      });
    });

    it('should reject duplicates but accept non-duplicates', async () => {
      mockReq = {
        body: {
          projectName: 'test-project',
          baseUrl: 'https://example.com',
          environment: 'production',
          variants: [
            {
              variantName: 'desktop',
              urls: ['https://example.com/page1'],
              iterations: 3,
              browser: 'chrome'
            },
            {
              variantName: 'mobile',
              urls: ['https://example.com/page2'],
              iterations: 5,
              browser: 'firefox'
            }
          ]
        }
      };

      // Mock running execution that matches desktop variant
      mockListExecutions.mockResolvedValue({
        executions: [{
          name: '1234567890-test-project-production-desktop-chrome',
          status: 'RUNNING',
          executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test:existing-execution'
        }]
      });

      // Mock successful execution start for non-duplicate
      mockStartExecution.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test:new-execution',
        startDate: new Date()
      });

      await postTask(mockReq as Request, mockRes as Response);

      expect(mockStartExecution).toHaveBeenCalledTimes(1);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        status: 'Task processing completed',
        summary: {
          totalVariants: 2,
          acceptedCount: 1,
          rejectedCount: 1
        },
        acceptedExecutions: expect.arrayContaining([
          expect.objectContaining({
            variantName: 'mobile',
            browser: 'firefox'
          })
        ]),
        rejectedExecutions: expect.arrayContaining([
          expect.objectContaining({
            variantName: 'desktop',
            browser: 'chrome',
            reason: 'A similar task is already running for variant desktop with browser chrome',
            runningExecutionName: '1234567890-test-project-production-desktop-chrome'
          })
        ])
      });
    });

    it('should handle AWS execution errors gracefully', async () => {
      mockReq = {
        body: {
          projectName: 'test-project',
          baseUrl: 'https://example.com',
          environment: 'production',
          variants: [{
            variantName: 'desktop',
            urls: ['https://example.com/page1'],
            iterations: 3,
            browser: 'chrome'
          }]
        }
      };

      // Mock no running executions
      mockListExecutions.mockResolvedValue({
        executions: []
      });

      // Mock execution start failure
      mockStartExecution.mockRejectedValue(new Error('AWS execution failed'));

      await postTask(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        status: 'Task processing completed',
        summary: {
          totalVariants: 1,
          acceptedCount: 0,
          rejectedCount: 1
        },
        acceptedExecutions: [],
        rejectedExecutions: expect.arrayContaining([
          expect.objectContaining({
            variantName: 'desktop',
            browser: 'chrome',
            reason: 'Failed to start execution: AWS execution failed'
          })
        ])
      });
    });
  });

  describe('ExecutionId sanitization', () => {
    it('should sanitize invalid characters in execution ID', async () => {
      mockReq = {
        body: {
          projectName: 'test project!@#',
          baseUrl: 'https://example.com',
          environment: 'prod env',
          variants: [{
            variantName: 'desktop[test]',
            urls: ['https://example.com/page1'],
            iterations: 3,
            browser: 'chrome'
          }]
        }
      };

      mockListExecutions.mockResolvedValue({
        executions: []
      });

      mockStartExecution.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test:execution-id',
        startDate: new Date()
      });

      await postTask(mockReq as Request, mockRes as Response);

      const startExecutionCall = mockStartExecution.mock.calls[0][0];
      const executionName = startExecutionCall.name;

      // Should not contain invalid characters
      expect(executionName).not.toMatch(/[\s<>{}\[\]?*"#%\\^|~`$&,;:/]/);
      // Should not have consecutive dashes
      expect(executionName).not.toMatch(/--+/);
    });
  });

  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockReq = {
        body: {
          projectName: 'test-project',
          baseUrl: 'https://example.com',
          environment: 'production',
          variants: [{
            variantName: 'desktop',
            urls: ['https://example.com/page1'],
            iterations: 3,
            browser: 'chrome'
          }]
        }
      };

      // Mock SFN listExecutions to throw an error
      mockListExecutions.mockRejectedValue(new Error('SFN service error'));

      await postTask(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});