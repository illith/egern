export default async function(ctx) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    'Accept': 'application/json',
  };

  // Yahoo Finance API 拉取行情
  async function fetchQuote(symbol, name) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;
      const resp = await ctx.http.get(url, { headers, timeout: 8000 });
      const data = await resp.json();
      const result = data.chart.result[0];
      const meta = result.meta;
      const closes = result.indicators.quote[0].close.filter(c => c != null);
      const prevClose = closes.length >= 2 ? closes[closes.length - 2] : meta.previousClose;
      const price = meta.regularMarketPrice;
      const change = price - prevClose;
      const changePct = (change / prevClose) * 100;
      return { name, price, change, changePct, symbol };
    } catch (e) {
      return null;
    }
  }

  // 并行拉取四个品种
  const [nasdaq, gold, oil, btc] = await Promise.all([
    fetchQuote('^IXIC', 'NASDAQ'),
    fetchQuote('GC=F', 'GOLD'),
    fetchQuote('CL=F', 'OIL'),
    fetchQuote('BTC-USD', 'BTC'),
  ]);

  const items = [nasdaq, gold, oil, btc].filter(Boolean);

  // 格式化价格
  function fmtPrice(item) {
    const p = item.price;
    if (item.name === 'NASDAQ') return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtChange(item) {
    const sign = item.change >= 0 ? '+' : '';
    return `${sign}${item.changePct.toFixed(1)}%`;
  }

  function changeColor(item) {
    return item.change >= 0 ? '#34C759' : '#FF3B30';
  }

  // 锁屏小尺寸
  if (ctx.widgetFamily === 'accessoryRectangular') {
    const lines = items.map(i =>
      `${i.name} ${fmtPrice(i)} ${i.change >= 0 ? '▲' : '▼'}${Math.abs(i.changePct).toFixed(1)}%`
    ).join('  ');
    return {
      type: 'widget',
      children: [{
        type: 'text',
        text: lines,
        font: { size: 'caption1', weight: 'medium', family: 'Menlo' },
        minScale: 0.4,
      }]
    };
  }

  // 锁屏圆形
  if (ctx.widgetFamily === 'accessoryCircular') {
    const btc = items.find(i => i.name === 'BTC');
    if (!btc) return errorWidget('BTC');
    return {
      type: 'widget',
      children: [{
        type: 'text',
        text: `BTC $${btc.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        font: { size: 'caption2', weight: 'bold' },
        textColor: changeColor(btc),
      }]
    };
  }

  // 主屏幕小尺寸
  if (ctx.widgetFamily === 'systemSmall') {
    return {
      type: 'widget',
      padding: 14,
      gap: 6,
      children: [
        ...items.map(item => ({
          type: 'stack',
          direction: 'row',
          alignItems: 'center',
          gap: 6,
          children: [
            {
              type: 'text',
              text: item.name,
              font: { size: 'body' },
            },
            { type: 'spacer', flex: 1 },
            {
              type: 'text',
              text: fmtPrice(item),
              font: { size: 'body', weight: 'semibold', family: 'Menlo' },
              textColor: '#8E8E93',
            },
            {
              type: 'text',
              text: `${item.change >= 0 ? '▲' : '▼'}${Math.abs(item.changePct).toFixed(1)}%`,
              font: { size: 'caption1', weight: 'medium', family: 'Menlo' },
              textColor: changeColor(item),
              minWidth: 50,
              textAlign: 'right',
            },
          ],
        })),
        {
          type: 'date',
          date: new Date().toISOString(),
          format: 'relative',
          font: { size: 'caption2' },
          textColor: '#636366',
        },
      ],
    };
  }

  // 主屏幕中尺寸（默认）- 金融终端风格
  return {
    type: 'widget',
    backgroundColor: '#000000',
    cornerRadius: 8,
    border: { color: '#333333', width: 1 },
    padding: [12, 14],
    gap: 0,
    children: [
      { type: 'spacer' },
      ...items.map((item, i) => ({
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      padding: [6, 0],
      children: [
        {
          type: 'text',
          text: item.name,
          font: { size: 'caption1', family: 'Menlo' },
          textColor: '#888888',
          minWidth: 55,
        },
        { type: 'spacer' },
        {
          type: 'text',
          text: fmtPrice(item),
          font: { size: 'caption1', weight: 'bold', family: 'Menlo' },
          textColor: '#cccccc',
          minScale: 0.5,
          textAlign: 'right',
        },
        {
          type: 'text',
          text: `${item.change >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%`,
          font: { size: 'caption1', family: 'Menlo' },
          textColor: changeColor(item),
          minWidth: 65,
          textAlign: 'right',
        },
      ],
    })),
      { type: 'spacer' },
    ],
  };

  function errorWidget(msg) {
    return {
      type: 'widget',
      padding: 16,
      children: [{
        type: 'text',
        text: `⚠️ ${msg}`,
        textColor: '#FF3B30',
      }],
    };
  }
};
