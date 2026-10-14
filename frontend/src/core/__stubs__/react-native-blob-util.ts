// Inert namespace stub for react-native-blob-util.
const RNUtil = {
  fs: {
    dirs: { DocumentDir: "", CacheDir: "" },
    readFile: async () => "",
    writeFile: async () => {},
  },
  config: () => RNUtil,
  fetch: async () => ({ data: "" }),
};
export default RNUtil;
