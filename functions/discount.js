export async function onRequest(context) {
  const resp = await fetch("https://iiifox.me/price.txt");
  const text = await resp.text();

  const lines = text.split("\n").map(l => l.trim()).filter(l => l);

  let date = "";
  let qz = {};
  let gbo = {};
  let currentTime = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 日期
    if (/^\d{4}-\d{2}-\d{2}$/.test(line)) {
      date = line;
      continue;
    }

    // 判断时间段
    if (line.includes("过点")) {
      currentTime = "00:00";
      qz[currentTime] = {};
      continue;
    }
    if (line.includes("9:25")) {
      currentTime = "09:25";
      qz[currentTime] = {};
      continue;
    }
    if (line.includes("11点")) {
      currentTime = "11:00";
      qz[currentTime] = {};
      continue;
    }

    // 微信部分开始
    if (line.startsWith("微信")) {
      currentTime = "gbo";
      continue;
    }

    // 渠道类（前半部分）
    if (["00:00", "09:25", "11:00"].includes(currentTime)) {
      let [name, price] = line.split(/\s+/);
      if (name && price) {
        qz[currentTime][name] = parseFloat(price) / 1000;
      }
    }

    // 微信部分
    if (currentTime === "gbo") {
      let [name, price] = line.split(/\s+/);
      if (name && price) {
        gbo[name] = parseFloat(price) / 100;
      }
    }
  }

  const result = { date, qz, gbo };

  return new Response(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
