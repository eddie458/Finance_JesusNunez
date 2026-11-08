import { saveFile } from './download.js'

// Spreadsheets run a cell that starts like a formula, so text like that gets a leading apostrophe. Plain numbers stay numbers.
const defuse = text => /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text) ? `'${text}` : text
const cell = value => { const text=defuse(String(value??'')); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g,'""')}"` : text }

export const toCsv = (columns, rows) => [columns.map(c=>c.label),...rows.map(row=>columns.map(c=>c.value(row)))].map(line=>line.map(cell).join(',')).join('\r\n')

export const slug = text => String(text??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')

// The byte order mark is what makes Excel read accents as UTF-8.
export const downloadCsv = (filename, csv) => saveFile(filename,['\uFEFF',csv],'text/csv;charset=utf-8')
