const str = "Möbel";
console.log("Length in JS:", str.length);
console.log("Byte length in UTF-8:", new Blob([str]).size);
