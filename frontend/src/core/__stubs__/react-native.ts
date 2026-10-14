// Test stub for react-native. Only Platform is used by the pure logic under test.
export const Platform = {
  OS: "android" as "android" | "ios" | "web",
  Version: 0,
  isPad: false,
  isTV: false,
  select: <T,>(spec: { android?: T; ios?: T; web?: T; default?: T }) =>
    spec.android ?? spec.default,
};
