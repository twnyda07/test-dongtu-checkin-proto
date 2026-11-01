/** 模組：電話正規化（寺方 2026-11-01：「個人查詢改成輸入完整電話，不用輸入名字；任何數字的輸入都要查得到」）
 *
 *  ★ 查詢端與資料端用**同一套**：這個檔一字不改地複製到
 *    ~/寶嚴工作坊/動土信眾報到原型/site/phone_norm.js（瀏覽器與 Node 也用它），測試會比對兩份是否一模一樣。
 *  ★ 只用 ES5＋String.prototype.normalize（Apps Script V8、瀏覽器、Node 都有）。
 *
 *  phoneNorm_(s)      一支電話 → 標準寫法（'0912345678'、'0223456789'、'089123456'）；不像電話回 ''
 *  phoneSplit_(cell)  一格裡寫了好幾支（/ 、 , 空白 「手機…家…」）→ 拆成陣列（原文片段）
 *  phoneIndexKeys_(s) 資料端：這支電話要登記在哪些鍵（完整＋末 9 碼）
 *  phoneQueryKeys_(s) 查詢端：依序要試的鍵（完整 → 末 9 碼 → 補 0 再試）
 */
function phoneDigits_(s){
  var t = String(s == null ? '' : s);
  if (t.normalize) t = t.normalize('NFKC');               // 全形數字、＋、（）、－ → 半形
  t = t.replace(/[‐-―−﹣－]/g, '-');
  // 分機：# / 轉 / 分機 / ext / x 之後的數字一律不算
  t = t.replace(/\s*(#|轉|分機|ext\.?|x)\s*\d*\s*$/i, '');
  t = t.replace(/(#|轉|分機|ext\.?)\s*\d+/ig, '');
  return t.replace(/\D/g, '');
}
function phoneNorm_(s){
  var d = phoneDigits_(s), cc = false;
  if (!d) return '';
  if (d.indexOf('00886') === 0){ d = d.slice(5); cc = true; }
  else if (d.indexOf('00') === 0 && d.length >= 10) return d.slice(2);   // 00＋外國國碼 → 跟 + 一樣（只留數字）
  else if (d.indexOf('886') === 0 && d.length >= 11){ d = d.slice(3); cc = true; }
  d = d.replace(/^0+/, '0');                              // +886 0912…（國碼後又多打 0）
  if (d.charAt(0) !== '0' && (cc || d.length === 9)) d = '0' + d;   // 國碼後一律補 0；912345678 → 0912345678；223456789 → 0223456789
  if (d.length < 7) return '';
  return d;                                               // 超過 10 碼不硬切（切了反而可能對到別人）
}
function phoneSplit_(cell){
  var t = String(cell == null ? '' : cell);
  if (t.normalize) t = t.normalize('NFKC');
  // 中文說明字（手機、家、公司、或…）當分隔；但「轉」「分機」是分機記號，要留著給 phoneDigits_ 處理
  t = t.replace(/轉/g, '\u0001').replace(/分機/g, '\u0002');
  t = t.replace(/[㐀-鿿豈-﫿]+/g, '/');
  t = t.replace(/\u0001/g, '轉').replace(/\u0002/g, '分機');
  var parts = t.split(/[\/、,;|\n]+/), out = [], i, j;
  for (i = 0; i < parts.length; i++){
    var p = parts[i].replace(/^\s+|\s+$/g, '');
    if (!p) continue;
    var dg = p.replace(/\D/g, '');
    if (dg.length <= 12 || !/\s/.test(p)){ if (dg.length >= 7) out.push(p); continue; }
    // 一段裡塞了好幾支、只用空白隔開：把空白分出來的小段依序接起來，湊滿一支就切
    var tk = p.split(/\s+/), cur = '', cd = '';
    for (j = 0; j < tk.length; j++){
      cur = cur ? cur + ' ' + tk[j] : tk[j]; cd += tk[j].replace(/\D/g, '');
      var need = /^09/.test(cd) ? 10 : (/^(886|\+886)/.test(cur.replace(/\s/g, '')) ? 12 : (/^0(2|4)/.test(cd) ? 10 : 9));
      if (cd.length >= need){ out.push(cur); cur = ''; cd = ''; }
    }
    if (cd.length >= 7) out.push(cur);
  }
  return out;
}
/** 台灣格式＝0 開頭 9～10 碼。其他（外國號碼、沒寫區碼的 8 碼）另外登記「末 8 碼」S 鍵：
 *  +65 9123 4567 跟只打 91234567 才對得上。S 鍵只在雙方都不是台灣格式時才用，台灣號碼不會走到這裡。 */
function phoneIsTw_(n){ return /^0\d{8,9}$/.test(n); }
function phoneIndexKeys_(s){
  var n = phoneNorm_(s);
  if (!n) return [];
  var k = ['F' + n];
  if (n.length >= 9) k.push('L' + n.slice(-9));
  if (!phoneIsTw_(n) && n.length >= 8) k.push('S' + n.slice(-8));
  return k;
}
function phoneQueryKeys_(s){
  var n = phoneNorm_(s), d = phoneDigits_(s), out = [], seen = {};
  function add(x){ if (x && !seen[x]){ seen[x] = 1; out.push(x); } }
  if (n) add('F' + n);
  if (n && n.length >= 9) add('L' + n.slice(-9));
  if (d && d.charAt(0) !== '0' && d.length >= 7 && d.length <= 9) add('F0' + d);   // 去開頭 0 的市話（089 → 89…）
  if (n && !phoneIsTw_(n) && n.length >= 8) add('S' + n.slice(-8));             // 外國號碼／沒寫國碼的 8 碼
  return out;
}
