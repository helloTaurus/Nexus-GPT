import crypto from 'node:crypto';
import type { AuditLogEntry } from '../services/auditService.ts';

export interface MerkleProofStep {
  position: 'left' | 'right';
  hash: string;
}

export class MerkleTree {
  private leaves: string[] = [];
  private layers: string[][] = [];

  constructor(records: AuditLogEntry[]) {
    this.build(records);
  }

  private hashPair(left: string, right: string): string {
    return crypto.createHash('sha256').update(left + right, 'utf-8').digest('hex');
  }

  private build(records: AuditLogEntry[]): void {
    if (records.length === 0) {
      this.leaves = [];
      this.layers = [['0000000000000000000000000000000000000000000000000000000000000000']];
      return;
    }

    // Leaf nodes are the SHA256 of the audit entry hash
    this.leaves = records.map(r =>
      crypto.createHash('sha256').update(r.hash, 'utf-8').digest('hex')
    );

    this.layers = [this.leaves];

    let currentLayer = this.leaves;
    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left; // Duplicate odd leaf
        nextLayer.push(this.hashPair(left, right));
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): string {
    if (this.layers.length === 0 || this.layers[this.layers.length - 1].length === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }
    return this.layers[this.layers.length - 1][0];
  }

  public getProof(leafIndex: number): MerkleProofStep[] {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Invalid leaf index: ${leafIndex}`);
    }

    const proof: MerkleProofStep[] = [];
    let idx = leafIndex;

    for (let layerIdx = 0; layerIdx < this.layers.length - 1; layerIdx++) {
      const layer = this.layers[layerIdx];
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1 < layer.length ? idx + 1 : idx;

      proof.push({
        position: isRight ? 'left' : 'right',
        hash: layer[siblingIdx]
      });

      idx = Math.floor(idx / 2);
    }

    return proof;
  }

  public static verifyProof(leafHash: string, proof: MerkleProofStep[], root: string): boolean {
    let currentHash = leafHash;

    for (const step of proof) {
      if (step.position === 'left') {
        currentHash = crypto.createHash('sha256').update(step.hash + currentHash, 'utf-8').digest('hex');
      } else {
        currentHash = crypto.createHash('sha256').update(currentHash + step.hash, 'utf-8').digest('hex');
      }
    }

    return currentHash === root;
  }
}
