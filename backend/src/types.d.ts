// Type declarations for modules without types
declare module 'circomlibjs' {
  export function buildMimcSponge(): Promise<{
    F: {
      toString: (v: any, radix?: number) => string;
      toObject: (v: any) => any;
    };
    multiHash: (inputs: any[], key?: any, numOutputs?: number) => any;
  }>;
}

