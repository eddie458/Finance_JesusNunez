const pad = n => String(n).padStart(2,'0')
export const localToday = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
export const today = localToday
export const shortDate = value => new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(`${value}T12:00:00`))
export const shiftMonth = (key, by) => { const [y,m]=key.split('-').map(Number); const d=new Date(y,m-1+by,1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}` }
export const monthRange = (from, to) => { const keys=[]; for (let key=from; key<=to; key=shiftMonth(key,1)) keys.push(key); return keys }
export const daysInMonth = key => { const [y,m]=key.split('-').map(Number); return new Date(y,m,0).getDate() }
export const monthName = key => new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(new Date(`${key}-01T12:00:00`))
export const monthShort = key => `${new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(`${key}-01T12:00:00`))} ’${key.slice(2,4)}`
export const monthLong = key => new Intl.DateTimeFormat('en',{month:'long'}).format(new Date(`${key}-01T12:00:00`))
export const monthAbbr = key => new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(`${key}-01T12:00:00`))
export const dayShort = value => new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`))
export const dayHeading = (value, today) => { const days=Math.round((new Date(`${today}T12:00:00`)-new Date(`${value}T12:00:00`))/86400000); if(days===0)return 'Today'; if(days===1)return 'Yesterday'; return value.slice(0,4)===today.slice(0,4)?dayShort(value):shortDate(value) }
