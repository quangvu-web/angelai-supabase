// Offline stub: no backend connected.
export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple", _opts?: unknown) => ({
      error: new Error("Chưa kết nối cơ sở dữ liệu"),
      redirected: false as const,
    }),
  },
};
