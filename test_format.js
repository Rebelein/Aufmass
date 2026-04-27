const padRight = (str, len) => str.substring(0, len).padEnd(len, ' ');
const padLeftZero = (num, len) => String(num).padStart(len, '0');

let index = 4;
let articleNumber = "BEDE0201";
let quantity = 1;
let name = "Bette Duschwanne Stahl 1400x800x35mm weiss mit Antirutsch";
let priceVal = 84.96;
let discountPrice = priceVal * 0.6;

let pos = 'POA'; // 1-3
pos += padLeftZero(index, 10); // 4-13 Handwerker Pos
pos += padLeftZero(index, 10); // 14-23 Großhändler Pos
pos += padRight(articleNumber, 15); // 24-38 Artikelnummer
pos += padLeftZero(Math.round(quantity * 1000), 11); // 39-49 Menge (3 NK)
pos += padRight(name, 40); // 50-89 Text 1
pos += padRight('', 40); // 90-129 Text 2
pos += padLeftZero(Math.round(priceVal * 10000), 12); // 130-141 Einzelpreis (4 NK)
pos += padLeftZero(Math.round(discountPrice * 10000), 12); // 142-153 Preis 2 (4 NK)
pos += padLeftZero(0, 9); // 154-162 Zeros
pos = padRight(pos, 182); // Pad to 182
pos += 'H';
pos = padRight(pos, 200);

console.log(pos);
console.log("Length:", pos.length);
