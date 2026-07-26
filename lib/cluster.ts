/**
 * Bias Noticer — Panel clustering for dense articles
 *
 * Groups same-type signals that appear near each other in document order
 * so the side panel stays scannable while page highlights stay individual.
 */

import type { BiasInstance, BiasType } from "./types";
import { getCategoryMeta } from "./taxonomy";

export interface BiasCluster {
  id: string;
  bias_type: BiasType;
  label: string;
  instances: BiasInstance[];
  maxSeverity: number;
  avgConfidence: number;
}

/**
 * Cluster consecutive same-type instances when there are 2+ of that type
 * overall, or collapse runs of 2+ consecutive same-type items.
 * Singleton types remain as single-item clusters.
 */
export function clusterInstances(
  instances: BiasInstance[],
  enabled: boolean
): BiasCluster[] {
  if (!enabled || instances.length === 0) {
    return instances.map((inst) => singleCluster(inst));
  }

  const typeCounts = new Map<BiasType, number>();
  for (const i of instances) {
    typeCounts.set(i.bias_type, (typeCounts.get(i.bias_type) ?? 0) + 1);
  }

  const clusters: BiasCluster[] = [];
  let run: BiasInstance[] = [];

  const flush = () => {
    if (!run.length) return;
    const type = run[0]!.bias_type;
    const shouldGroup = run.length >= 2 && (typeCounts.get(type) ?? 0) >= 2;
    if (shouldGroup) {
      clusters.push(makeCluster(run));
    } else {
      for (const inst of run) clusters.push(singleCluster(inst));
    }
    run = [];
  };

  for (const inst of instances) {
    if (!run.length || run[0]!.bias_type === inst.bias_type) {
      run.push(inst);
    } else {
      flush();
      run.push(inst);
    }
  }
  flush();

  return clusters;
}

function singleCluster(inst: BiasInstance): BiasCluster {
  return makeCluster([inst]);
}

function makeCluster(instances: BiasInstance[]): BiasCluster {
  const type = instances[0]!.bias_type;
  const meta = getCategoryMeta(type);
  const maxSeverity = Math.max(...instances.map((i) => i.severity));
  const avgConfidence =
    instances.reduce((s, i) => s + i.confidence, 0) / instances.length;
  return {
    id: `cluster_${type}_${instances.map((i) => i.id).join("_").slice(0, 48)}`,
    bias_type: type,
    label:
      instances.length > 1
        ? `${meta.label} cluster (${instances.length} instances)`
        : meta.label,
    instances,
    maxSeverity,
    avgConfidence,
  };
}
