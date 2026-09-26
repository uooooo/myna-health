declare module "circomlibjs" {
  export function buildPoseidon(): Promise<any>;
  export function buildEddsa(): Promise<any>;
}
declare module "snarkjs" {
  export const groth16: {
    fullProve(input: Record<string, unknown>, wasm: string, zkey: string): Promise<{ proof: Record<string, unknown>; publicSignals: string[] }>;
    verify(vk: Record<string, unknown>, signals: string[], proof: Record<string, unknown>): Promise<boolean>;
    exportSolidityCallData(proof: Record<string, unknown>, signals: string[]): Promise<string>;
  };
}
