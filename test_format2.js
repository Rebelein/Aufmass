const padRight = (str, len) => str.substring(0, len).padEnd(len, ' ');
const padLeftZero = (num, len) => String(num).padStart(len, '0');

let index = 4;
let articleNumber = "BEDE0201";
let quantity = 1;
let name = "Bette Duschwanne Stahl 1400x800x35mm weiss mit Antirutsch";
let priceVal = 84.96;
let discountPrice = priceVal * 0.6;

let pos = 'POA'; // 1-3
pos += padLeftZero(index, 10); // 4-13
pos += padLeftZero(index, 10); // 14-23
pos += padRight(articleNumber, 15); // 24-38
pos += padLeftZero(Math.round(quantity * 1000), 11); // 39-49
let text1 = name.substring(0, 40);
let text2 = name.substring(40, 80);
pos += padRight(text1, 40); // 50-89
pos += padRight(text2, 40); // 90-129
pos += padLeftZero(Math.round(priceVal * 10000), 12); // 130-141
pos += padLeftZero(Math.round(discountPrice * 10000), 12); // 142-153
pos += padLeftZero(0, 9); // 154-162 Zeros
pos = padRight(pos, 182); // Pad to 182
pos += 'H';
pos = padRight(pos, 200);

console.log(pos);
console.log("Length:", pos.length);
