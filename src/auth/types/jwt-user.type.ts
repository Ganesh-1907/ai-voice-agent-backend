export type JwtUser = {
  sub: string;
  email: string;
  name: string;
  role?: "super_admin" | "owner" | "admin" | "staff";
  businessId?: string | null;
};
