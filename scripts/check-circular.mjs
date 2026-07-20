import madge from 'madge';

const roots = ['apps/api/src', 'apps/web/src', 'packages'];

/** Nest modules use forwardRef; TypeORM entities relate bidirectionally; routeTree is generated. */
function isAllowedCycle(cycle) {
  const paths = cycle.map((f) => f.replace(/\\/g, '/'));
  // Generated TanStack router graph always couples to router.tsx
  if (paths.some((p) => /routeTree\.gen\.ts$/.test(p))) return true;
  return paths.every((p) => /\.entity\.ts$/.test(p) || /\.module\.ts$/.test(p));
}

const result = await madge(roots, {
  fileExtensions: ['ts', 'tsx'],
  tsConfig: 'tsconfig.base.json',
});

const cycles = result.circular().filter((c) => !isAllowedCycle(c));

if (cycles.length) {
  console.error(`Found ${cycles.length} disallowed circular dependencies:\n`);
  for (const [i, cycle] of cycles.entries()) {
    console.error(`${i + 1}) ${cycle.join(' > ')}`);
  }
  process.exit(1);
}

console.log('No disallowed circular dependencies.');
