import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new account',
    description: 'Tạo tài khoản mới. Email phải unique. Password tối thiểu 8 ký tự. Tự động tạo Free subscription.',
  })
  @ApiResponse({ status: 201, description: '{ user: { id, email, fullName }, accessToken: "..." }' })
  @ApiResponse({ status: 400, description: 'Validation error — email format, password too short' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description: 'Đăng nhập và nhận JWT token (expires: 7 ngày). Dùng token cho header `Authorization: Bearer <token>`.',
  })
  @ApiResponse({ status: 200, description: '{ user: { id, email, fullName, systemRole }, accessToken: "..." }' })
  @ApiResponse({ status: 401, description: 'Email hoặc password không đúng' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
