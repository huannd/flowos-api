import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class N8nClientService {
  private readonly logger = new Logger(N8nClientService.name);
  private readonly http: AxiosInstance;

  constructor(private configService: ConfigService) {
    const baseURL =
      this.configService.get<string>('N8N_API_URL') ||
      'http://localhost:5679';
    const apiKey = this.configService.get<string>('N8N_API_KEY') || '';

    if (!apiKey) {
      this.logger.warn('⚠️  N8N_API_KEY not configured — n8n API calls (getWorkflows, executeWorkflow) will fail');
    }

    this.http = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-N8N-API-KEY': apiKey } : {}),
      },
    });
  }

  /**
   * Get all workflows from n8n.
   */
  async getWorkflows(): Promise<unknown[]> {
    try {
      const { data } = await this.http.get('/api/v1/workflows');
      return data.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch n8n workflows', error);
      throw new HttpException(
        'n8n engine unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get a single workflow by ID.
   */
  async getWorkflow(workflowId: string): Promise<unknown> {
    try {
      const { data } = await this.http.get(
        `/api/v1/workflows/${workflowId}`,
      );
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch n8n workflow ${workflowId}`, error);
      throw new HttpException(
        'n8n workflow not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Trigger a workflow via its webhook URL.
   * This is the primary way FlowOS executes automations.
   */
  async triggerWebhook(
    webhookPath: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const baseURL =
        this.configService.get<string>('N8N_API_URL') ||
        'http://localhost:5679';
      const url = `${baseURL}/webhook/${webhookPath}`;

      this.logger.log(`Triggering n8n webhook: ${url}`);
      const { data } = await axios.post(url, payload, { timeout: 30000 });
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to trigger n8n webhook: ${webhookPath}`,
        error,
      );
      throw new HttpException(
        'Failed to trigger automation',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Execute a workflow via n8n API (alternative to webhook).
   */
  async executeWorkflow(
    workflowId: string,
    inputData: Record<string, unknown>,
  ): Promise<{ executionId: string }> {
    try {
      // n8n API v1 execution endpoint
      const { data } = await this.http.post(
        `/api/v1/workflows/${workflowId}/run`,
        { data: inputData },
      );
      return { executionId: data.data?.executionId || data.executionId };
    } catch (error) {
      this.logger.error(
        `Failed to execute n8n workflow ${workflowId}`,
        error,
      );
      throw new HttpException(
        'Failed to execute automation',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Get execution result from n8n.
   */
  async getExecution(executionId: string): Promise<unknown> {
    try {
      const { data } = await this.http.get(
        `/api/v1/executions/${executionId}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch n8n execution ${executionId}`,
        error,
      );
      return null;
    }
  }

  /**
   * Health check — verify n8n is reachable.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.http.get('/healthz');
      return true;
    } catch {
      return false;
    }
  }
}
