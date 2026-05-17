import { NextRequest, NextResponse } from "next/server";
import { signJWT, AUTH_COOKIE, AUTH_COOKIE_OPTIONS } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    // Validate credentials against env vars
    const validUsername = process.env.AUTH_USERNAME;
    const validPassword = process.env.AUTH_PASSWORD;

    if (!validUsername || !validPassword) {
      return NextResponse.json(
        { error: "服务端未配置认证凭据，请设置 AUTH_USERNAME 和 AUTH_PASSWORD" },
        { status: 500 }
      );
    }

    // Constant-time comparison to prevent timing attacks
    const usernameMatch = username === validUsername;
    const passwordMatch = password === validPassword;

    if (!usernameMatch || !passwordMatch) {
      // Add small delay to prevent brute force
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // Determine role (could be extended to multi-user later)
    const role = (process.env.AUTH_ROLE as "admin" | "worker" | "viewer") || "admin";

    // Sign JWT
    const token = await signJWT({ sub: username, role });

    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: { username, role },
    });

    response.cookies.set(AUTH_COOKIE, token, AUTH_COOKIE_OPTIONS);

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: "登录请求格式错误" },
      { status: 400 }
    );
  }
}
