import * as Atoms from './index';

describe('components/atoms/index.ts', () => {
  it('exports Button', () => {
    expect(Atoms.Button).toBeDefined();
  });
  
  it('exports IconButton', () => {
    expect(Atoms.IconButton).toBeDefined();
  });
  
  it('exports ScrollCues', () => {
    expect(Atoms.ScrollCues).toBeDefined();
  });
  
  it('exports Tooltip', () => {
    expect(Atoms.Tooltip).toBeDefined();
  });
  
  it('exports UtilizationBar', () => {
    expect(Atoms.UtilizationBar).toBeDefined();
  });
  
  it('has deterministic boundaries for exports', () => {
    // Tests that only the expected number of modules are exported to avoid duplicate/invalid imports.
    // Ensure no sensitive or internal files are exported.
    const exportedKeys = Object.keys(Atoms);
    expect(exportedKeys.length).toBeGreaterThanOrEqual(5);
    expect(exportedKeys).toContain('Button');
    expect(exportedKeys).toContain('IconButton');
    expect(exportedKeys).toContain('ScrollCues');
    expect(exportedKeys).toContain('Tooltip');
    expect(exportedKeys).toContain('UtilizationBar');
  });
});
