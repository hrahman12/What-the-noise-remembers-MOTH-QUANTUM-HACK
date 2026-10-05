export const meta = {
  name: 'restore-then-fez',
  description: 'Restore-and-audit the given pieces, then run the ibm_fez pass on the ones that need hardware',
  phases: [
    { title: 'Restore+Audit', detail: 'restore_audit.js per piece' },
    { title: 'Fez', detail: 'fez_pass.js after that piece has passed restore-and-audit' },
  ],
}
const DIR = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM\\common\\workflows\\'
const FEZ = args.fez || {slugs: [], briefs: {}, allowance: {}}
const one = async s => {
  const ra = await workflow({scriptPath: DIR + 'restore_audit.js'}, {slugs: [s]})
  log(`${s}: restore-and-audit ${JSON.stringify(ra)}`)
  if (!FEZ.slugs.includes(s)) return {slug: s, ra}
  const fz = await workflow({scriptPath: DIR + 'fez_pass.js'}, {slugs: [s], briefs: FEZ.briefs, allowance: FEZ.allowance})
  log(`${s}: ibm_fez ${JSON.stringify(fz)}`)
  return {slug: s, ra, fz}
}
return await parallel(args.slugs.map(s => () => one(s)))
