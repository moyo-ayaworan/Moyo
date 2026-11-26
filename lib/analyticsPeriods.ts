export type AnalyticsPeriodRow = { period: string; views: number; visitors: number; downloads: number; purchases: number; revenue: number };
export function analyticsPeriodRows(days: number, traffic: Array<Record<string, unknown>>, sales: Array<Record<string, unknown>>, grouping: 'daily'|'weekly'|'monthly', now = new Date()): AnalyticsPeriodRow[] {
 const rows=new Map<string,AnalyticsPeriodRow>();
 for(let i=days-1;i>=0;i--){
  const date=new Date(now);date.setUTCDate(date.getUTCDate()-i);const day=date.toISOString().slice(0,10);
  const monday=new Date(date);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  const key=grouping==='monthly'?day.slice(0,7):grouping==='weekly'?monday.toISOString().slice(0,10):day;
  const row=rows.get(key)||{period:key,views:0,visitors:0,downloads:0,purchases:0,revenue:0};
  const t=traffic.find(r=>r.day===day),s=sales.find(r=>r.day===day);
  row.views+=Number(t?.views||0);row.visitors+=Number(t?.visitors||0);row.downloads+=Number(t?.downloads||0);row.purchases+=Number(s?.purchases||0);row.revenue+=Number(s?.revenue||0);
  rows.set(key,row);
 }
 return [...rows.values()];
}
