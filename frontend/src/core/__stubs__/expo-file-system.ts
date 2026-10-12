// Test stub for expo-file-system (new API). Pure logic under test never
// performs real file IO, so these are inert placeholders.
class File {
  uri: string;
  constructor(uri: string) {
    this.uri = uri;
  }
  async exists() {
    return false;
  }
  async text() {
    return "";
  }
  async base64() {
    return "";
  }
}
class Directory {
  uri: string;
  constructor(uri: string) {
    this.uri = uri;
  }
  async exists() {
    return false;
  }
}
export const Paths = {
  cache: { uri: "file:///cache/" },
  document: { uri: "file:///document/" },
};
export { File, Directory };
