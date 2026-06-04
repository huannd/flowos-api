import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { UpgradePlanDto, PaymentWebhookDto } from './dto/billing.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('plans')
  @ApiOperation({
    summary: 'List available pricing plans',
    description: 'Trả về danh sách gói (Free, Pro, Business). Không yêu cầu auth.',
  })
  @ApiResponse({ status: 200, description: '[{ id, name, price, executionLimit, features, ... }]' })
  getPlans() {
    return this.billingService.getPlans();
  }

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current subscription details',
    description: 'Thông tin subscription hiện tại: plan, status, ngày bắt đầu/kết thúc.',
  })
  @ApiResponse({ status: 200, description: '{ subscription: { plan, status, startDate, endDate } }' })
  @ApiResponse({ status: 404, description: 'No active subscription (Free plan)' })
  getSubscription(@Req() req: any) {
    return this.billingService.getSubscription(req.user.userId);
  }

  @Get('quota')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current month quota usage',
    description: 'Số execution đã dùng / giới hạn trong tháng hiện tại.',
  })
  @ApiResponse({ status: 200, description: '{ plan, executionLimit, executionsUsed, executionsRemaining, month }' })
  getQuota(@Req() req: any) {
    return this.billingService.getQuota(req.user.userId);
  }

  @Post('upgrade')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upgrade or change plan',
    description: 'Nâng cấp gói. Nếu đang có subscription, sẽ chuyển đổi. Cần planId hợp lệ.',
  })
  @ApiResponse({ status: 200, description: '{ subscription, message: "Plan changed successfully" }' })
  @ApiResponse({ status: 400, description: 'Invalid plan or already on this plan' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  changePlan(@Req() req: any, @Body() dto: UpgradePlanDto) {
    return this.billingService.changePlan(req.user.userId, dto.planId);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel current subscription',
    description: 'Hủy subscription hiện tại. Sẽ chuyển về Free plan.',
  })
  @ApiResponse({ status: 200, description: '{ message: "Subscription canceled" }' })
  @ApiResponse({ status: 404, description: 'No active subscription to cancel' })
  cancelSubscription(@Req() req: any) {
    return this.billingService.cancelSubscription(req.user.userId);
  }

  @Get('invoices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get invoice history (last 12 months)',
    description: 'Lịch sử hóa đơn thanh toán trong 12 tháng gần nhất.',
  })
  @ApiResponse({ status: 200, description: '[{ month, plan, amount, status, paidAt }]' })
  getInvoices(@Req() req: any) {
    return this.billingService.getInvoices(req.user.userId);
  }

  @Post('webhook/payment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Payment provider webhook callback',
    description: 'Nhận callback từ payment provider (VNPay, Momo, Stripe). Xác thực chữ ký HMAC-SHA256 trước khi xử lý.',
  })
  @ApiResponse({ status: 200, description: '{ received: true }' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  processPayment(@Body() dto: PaymentWebhookDto) {
    return this.billingService.processPaymentWebhook(dto);
  }
}
