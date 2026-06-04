import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Trả về thông tin profile: email, fullName, avatar, systemRole, plan hiện tại.',
  })
  @ApiResponse({ status: 200, description: '{ id, email, fullName, avatar, systemRole, createdAt }' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or expired JWT' })
  getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Cập nhật fullName và/hoặc avatar. Chỉ gửi các field cần thay đổi.',
  })
  @ApiResponse({ status: 200, description: 'Updated profile object' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.userId, dto);
  }
}
