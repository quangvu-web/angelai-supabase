// Offline stub: this project is intentionally NOT connected to a database.
// Every query resolves to empty data so copied pages render without a backend.
/* eslint-disable @typescript-eslint/no-explicit-any */

const EMPTY = { data: null, error: null, count: 0, status: 200, statusText: "OK" };

function chain(): any {
  const target = function () {} as any;
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown) => Promise.resolve(EMPTY).then(resolve);
      }
      if (prop === Symbol.toPrimitive) return () => "";
      return chain();
    },
    apply() {
      return chain();
    },
  });
}

const subscription = { unsubscribe: () => {} };

const auth = {
  getSession: async () => ({ data: { session: null }, error: null }),
  getUser: async () => ({ data: { user: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription } }),
  signOut: async () => ({ error: null }),
  signInWithPassword: async () => ({
    data: { user: null, session: null },
    error: new Error("Chưa kết nối cơ sở dữ liệu"),
  }),
  signUp: async () => ({
    data: { user: null, session: null },
    error: new Error("Chưa kết nối cơ sở dữ liệu"),
  }),
  signInWithOtp: async () => ({ data: null, error: new Error("Chưa kết nối cơ sở dữ liệu") }),
  signInWithOAuth: async () => ({ data: null, error: new Error("Chưa kết nối cơ sở dữ liệu") }),
  resetPasswordForEmail: async () => ({ data: null, error: new Error("Chưa kết nối cơ sở dữ liệu") }),
  updateUser: async () => ({ data: { user: null }, error: new Error("Chưa kết nối cơ sở dữ liệu") }),
  setSession: async () => ({ data: { session: null, user: null }, error: null }),
  refreshSession: async () => ({ data: { session: null, user: null }, error: null }),
  exchangeCodeForSession: async () => ({ data: { session: null, user: null }, error: null }),
  verifyOtp: async () => ({ data: { session: null, user: null }, error: new Error("Chưa kết nối cơ sở dữ liệu") }),
  mfa: chain(),
  admin: chain(),
};

function channel(): any {
  const c: any = {
    on: () => c,
    subscribe: () => c,
    unsubscribe: async () => "ok",
    send: async () => "ok",
    track: async () => "ok",
    untrack: async () => "ok",
    presenceState: () => ({}),
  };
  return c;
}

export const supabase: any = {
  auth,
  from: () => chain(),
  rpc: () => chain(),
  schema: () => ({ from: () => chain(), rpc: () => chain() }),
  channel: () => channel(),
  removeChannel: async () => "ok",
  removeAllChannels: async () => [],
  getChannels: () => [],
  functions: { invoke: async () => ({ data: null, error: new Error("Chưa kết nối cơ sở dữ liệu") }) },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: new Error("Chưa kết nối cơ sở dữ liệu") }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      createSignedUrl: async () => ({ data: null, error: null }),
      remove: async () => ({ data: null, error: null }),
      list: async () => ({ data: [], error: null }),
      download: async () => ({ data: null, error: null }),
    }),
  },
};
