const Terser = require("terser");
const { globSync } = require("glob");
const fs = require("fs");
const path = require("path");

// Use a glob pattern to select all .js files in the 'src' directory and its subdirectories
console.log("minfiuing", __dirname + "/dist/**/*.js");
const files = globSync(__dirname + "/dist/esm/**/*.js", (err, files) => {});

console.log("f");
console.log(files);

files.forEach((file) => {
  console.log(file);
  fs.readFile(file, "utf8", async (err, data) => {
    if (err) throw err;

    // Minify the file contents
    const result = await Terser.minify(data);
    if (result.error) throw result.error;

    // Write the minified contents to a new file in the 'dist' directory
    const distFilePath = file;
    console.log(result);
    fs.writeFile(distFilePath, result.code, (err) => {
      if (err) throw err;
    });
  });
});
