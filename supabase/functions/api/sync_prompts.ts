// Génère prompts.ts à partir des prompts de référence (apps/api/app/prompts/*.md).
// Une Edge Function n'embarque pas de fichiers annexes : les prompts sont donc compilés en module.
export const SOURCE = new URL('../../../apps/api/app/prompts/', import.meta.url);
export const TARGET = new URL('./prompts.ts', import.meta.url);

export async function render(): Promise<string> {
  const read = (name: string) => Deno.readTextFile(new URL(`${name}.md`, SOURCE));
  const [plate, label] = await Promise.all([read('plate'), read('label')]);
  return `// Fichier généré par \`deno task sync-prompts\` depuis apps/api/app/prompts/. Ne pas modifier à la main.\nexport const PROMPTS = {\n  plate: ${JSON.stringify(plate)},\n  label: ${JSON.stringify(label)},\n} as const;\n`;
}

if (import.meta.main) {
  await Deno.writeTextFile(TARGET, await render());
  console.log('prompts.ts mis à jour');
}
