export const today = () => new Date().toISOString().slice(0,10)
export const shortDate = value => new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(`${value}T12:00:00`))
