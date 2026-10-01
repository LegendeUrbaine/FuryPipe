import { createHash } from 'node:crypto';

export const FURY_EVAL_DATASET_FORMAT = 'furypipe-eval-dataset/v1' as const;
export const FURY_EVAL_REPORT_FORMAT = 'furypipe-eval-report/v1' as const;
export const FURY_EVAL_COMPARISON_FORMAT = 'furypipe-eval-comparison/v1' as const;

export type FuryEvalDomain = 'routing' | 'skills' | 'instructions' | 'memory' | 'agents' | 'browser' | 'providers' | 'media' | 'video' | 'cost' | 'context';

export const FURY_EVAL_DOMAINS: readonly FuryEvalDomain[] = Object.freeze([
  'routing', 'skills', 'instructions', 'memory', 'agents', 'browser', 'providers', 'media', 'video', 'cost', 'context',
]);

export interface FuryEvalHistoryInput {
  readonly commit?: string | null;
  readonly environment?: string;
  readonly timestamp?: string;
}

export interface FuryEvalCase {
  readonly id: string;
  readonly domain: FuryEvalDomain;
  readonly objective: string;
  readonly expected: readonly string[];
  readonly observed: readonly string[];
  readonly success: boolean;
  readonly latencyMs?: number;
  readonly costUsd?: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface FuryEvalDataset {
  readonly format: typeof FURY_EVAL_DATASET_FORMAT;
  readonly id: string;
  readonly version: string;
  readonly cases: readonly FuryEvalCase[];
  readonly history?: FuryEvalHistoryInput;
}

export interface FuryEvalDomainMetrics {
  readonly cases: number;
  readonly successes: number;
  readonly successRate: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly meanLatencyMs: number | null;
  readonly meanCostUsd: number | null;
}

export interface FuryEvalHistoryEntry {
  readonly commit: string | null;
  readonly datasetDigestSha256: string;
  readonly resultDigestSha256: string;
  readonly metrics: FuryEvalDomainMetrics;
  readonly environment: string | null;
  readonly timestamp: string | null;
}

export interface FuryEvalCaseResult {
  readonly id: string;
  readonly domain: FuryEvalDomain;
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly success: boolean;
}

export interface FuryEvalReport {
  readonly format: typeof FURY_EVAL_REPORT_FORMAT;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetDigestSha256: string;
  readonly resultDigestSha256: string;
  readonly cases: readonly FuryEvalCaseResult[];
  readonly overall: FuryEvalDomainMetrics;
  readonly byDomain: Readonly<Partial<Record<FuryEvalDomain, FuryEvalDomainMetrics>>>;
  readonly history: FuryEvalHistoryEntry;
  readonly executionAuthorized: false;
}

export interface FuryEvalComparison {
  readonly format: typeof FURY_EVAL_COMPARISON_FORMAT;
  readonly baselineDigestSha256: string;
  readonly candidateDigestSha256: string;
  readonly baselineResultDigestSha256: string;
  readonly candidateResultDigestSha256: string;
  readonly comparable: boolean;
  readonly deltas: {
    readonly successRate: number;
    readonly precision: number;
    readonly recall: number;
    readonly f1: number;
    readonly meanLatencyMs: number | null;
    readonly meanCostUsd: number | null;
  };
  readonly regressions: readonly string[];
  readonly improvements: readonly string[];
  readonly executionAuthorized: false;
}

const DOMAINS = new Set<FuryEvalDomain>(FURY_EVAL_DOMAINS);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@#-]{0,127}$/u;
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u;
const COMMIT_RE = /^[0-9a-f]{7,64}$/iu;
const MAX_CASES = 10_000;
const MAX_OBJECTIVE = 32_768;
const MAX_LABELS = 256;
const MAX_LABEL = 256;

function round(value:number):number{
  return Number(value.toFixed(6));
}

function boundedId(value:unknown,label:string):string{
  if(typeof value!=='string'||!ID_RE.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function finiteOptional(value:unknown,label:string):number|undefined{
  if(value===undefined) return undefined;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0) throw new Error(`${label} must be a non-negative finite number`);
  return value;
}

function normalizeLabels(value:unknown,label:string):readonly string[]{
  if(!Array.isArray(value)||value.length>MAX_LABELS) throw new Error(`${label} must be a bounded array`);
  const out:string[]=[];
  const seen=new Set<string>();
  for(const item of value){
    if(typeof item!=='string'||item.length<1||item.length>MAX_LABEL||/[\u0000-\u001f\u007f]/u.test(item)) throw new Error(`${label} contains an invalid item`);
    if(!seen.has(item)){seen.add(item);out.push(item);}
  }
  return Object.freeze(out.sort((a,b)=>a.localeCompare(b)));
}

function normalizeHistory(value:unknown):Readonly<FuryEvalHistoryInput>|undefined{
  if(value===undefined) return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('eval history is invalid');
  const record=value as Record<string,unknown>;
  if(Object.keys(record).some((key)=>!['commit','environment','timestamp'].includes(key))) throw new Error('eval history contains an unknown key');
  let commit:string|null|undefined;
  if(record.commit!==undefined){
    if(record.commit!==null&&(typeof record.commit!=='string'||!COMMIT_RE.test(record.commit))) throw new Error('eval history commit is invalid');
    commit=record.commit===null?null:record.commit.toLowerCase();
  }
  let environment:string|undefined;
  if(record.environment!==undefined){
    if(typeof record.environment!=='string'||!record.environment.trim()||record.environment.length>128||/[\u0000-\u001f\u007f]/u.test(record.environment)) throw new Error('eval history environment is invalid');
    environment=record.environment.trim();
  }
  let timestamp:string|undefined;
  if(record.timestamp!==undefined){
    if(typeof record.timestamp!=='string'||!record.timestamp.trim()||!Number.isFinite(Date.parse(record.timestamp))) throw new Error('eval history timestamp is invalid');
    timestamp=new Date(record.timestamp).toISOString();
  }
  return Object.freeze({
    ...(commit===undefined?{}:{commit}),
    ...(environment===undefined?{}:{environment}),
    ...(timestamp===undefined?{}:{timestamp}),
  });
}

function validateCase(input:FuryEvalCase):FuryEvalCase{
  if(!input||typeof input!=='object') throw new Error('eval case is required');
  if(!DOMAINS.has(input.domain)) throw new Error('eval case domain is unsupported');
  if(typeof input.objective!=='string'||!input.objective.trim()||input.objective.length>MAX_OBJECTIVE||input.objective.includes('\0')) throw new Error('eval case objective is invalid');
  if(typeof input.success!=='boolean') throw new Error('eval case success must be boolean');
  const latencyMs=finiteOptional(input.latencyMs,'latencyMs');
  const costUsd=finiteOptional(input.costUsd,'costUsd');
  let metadata:Readonly<Record<string,string|number|boolean|null>>|undefined;
  if(input.metadata!==undefined){
    if(!input.metadata||typeof input.metadata!=='object'||Array.isArray(input.metadata)||Object.keys(input.metadata).length>64) throw new Error('eval case metadata is invalid');
    const normalized:Record<string,string|number|boolean|null>={};
    for(const [key,value] of Object.entries(input.metadata)){
      if(!ID_RE.test(key)||!(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')||(typeof value==='number'&&!Number.isFinite(value))||(typeof value==='string'&&value.length>1024)) throw new Error('eval case metadata contains invalid data');
      normalized[key]=value;
    }
    metadata=Object.freeze(normalized);
  }
  return Object.freeze({
    id:boundedId(input.id,'eval case id'),
    domain:input.domain,
    objective:input.objective.trim(),
    expected:normalizeLabels(input.expected,'expected'),
    observed:normalizeLabels(input.observed,'observed'),
    success:input.success,
    ...(latencyMs===undefined?{}:{latencyMs}),
    ...(costUsd===undefined?{}:{costUsd}),
    ...(metadata===undefined?{}:{metadata}),
  });
}

function digest(value:unknown):string{
  return createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
}

function metrics(cases:readonly FuryEvalCaseResult[], source:readonly FuryEvalCase[]):FuryEvalDomainMetrics{
  const tp=cases.reduce((n,c)=>n+c.truePositive,0);
  const fp=cases.reduce((n,c)=>n+c.falsePositive,0);
  const fn=cases.reduce((n,c)=>n+c.falseNegative,0);
  const successes=cases.filter(c=>c.success).length;
  const precision=tp+fp===0?(tp===0&&fn===0?1:0):tp/(tp+fp);
  const recall=tp+fn===0?1:tp/(tp+fn);
  const f1=precision+recall===0?0:(2*precision*recall)/(precision+recall);
  const latencies=source.flatMap(c=>c.latencyMs===undefined?[]:[c.latencyMs]);
  const costs=source.flatMap(c=>c.costUsd===undefined?[]:[c.costUsd]);
  return Object.freeze({
    cases:cases.length,
    successes,
    successRate:cases.length===0?0:round(successes/cases.length),
    precision:round(precision),
    recall:round(recall),
    f1:round(f1),
    meanLatencyMs:latencies.length===0?null:round(latencies.reduce((a,b)=>a+b,0)/latencies.length),
    meanCostUsd:costs.length===0?null:round(costs.reduce((a,b)=>a+b,0)/costs.length),
  });
}

export function evaluateFuryDataset(dataset:FuryEvalDataset):FuryEvalReport{
  if(!dataset||typeof dataset!=='object'||dataset.format!==FURY_EVAL_DATASET_FORMAT) throw new Error('unsupported FuryEval dataset');
  const id=boundedId(dataset.id,'dataset id');
  if(typeof dataset.version!=='string'||!VERSION_RE.test(dataset.version)) throw new Error('dataset version is invalid');
  if(!Array.isArray(dataset.cases)||dataset.cases.length<1||dataset.cases.length>MAX_CASES) throw new Error('dataset cases must contain 1..10000 items');
  const historyInput=normalizeHistory(dataset.history);
  const seen=new Set<string>();
  const normalized=dataset.cases.map((item)=>{
    const value=validateCase(item);
    if(seen.has(value.id)) throw new Error(`duplicate eval case id ${value.id}`);
    seen.add(value.id);
    return value;
  });
  const caseResults=normalized.map((item)=>{
    const expected=new Set(item.expected), observed=new Set(item.observed);
    let tp=0,fp=0,fn=0;
    for(const value of observed){ if(expected.has(value)) tp++; else fp++; }
    for(const value of expected){ if(!observed.has(value)) fn++; }
    const precision=tp+fp===0?(expected.size===0?1:0):tp/(tp+fp);
    const recall=tp+fn===0?1:tp/(tp+fn);
    const f1=precision+recall===0?0:(2*precision*recall)/(precision+recall);
    return Object.freeze({
      id:item.id,domain:item.domain,truePositive:tp,falsePositive:fp,falseNegative:fn,
      precision:round(precision),recall:round(recall),f1:round(f1),success:item.success,
    });
  });
  // The dataset digest identifies the evaluation population and expectations.
  // Observations, success annotations, latency, cost and history belong to a
  // report/run; including them would make two runs on the same dataset look
  // incomparable by construction.
  const canonicalDataset=Object.freeze({
    format:FURY_EVAL_DATASET_FORMAT,
    id,
    version:dataset.version,
    cases:Object.freeze(normalized.map((item)=>Object.freeze({
      id:item.id,
      domain:item.domain,
      objective:item.objective,
      expected:item.expected,
      ...(item.metadata===undefined?{}:{metadata:item.metadata}),
    }))),
  });
  const datasetDigestSha256=digest(canonicalDataset);
  const byDomain:Partial<Record<FuryEvalDomain,FuryEvalDomainMetrics>>={};
  for(const domain of DOMAINS){
    const indices=normalized.map((c,i)=>c.domain===domain?i:-1).filter(i=>i>=0);
    if(indices.length>0){
      byDomain[domain]=metrics(indices.map(i=>caseResults[i]!),indices.map(i=>normalized[i]!));
    }
  }
  const frozenCases=Object.freeze(caseResults);
  const overall=metrics(caseResults,normalized);
  const frozenByDomain=Object.freeze(byDomain);
  const resultDigestSha256=digest(Object.freeze({format:FURY_EVAL_REPORT_FORMAT,cases:frozenCases,overall,byDomain:frozenByDomain}));
  const history=Object.freeze({
    commit:historyInput?.commit??null,
    datasetDigestSha256,
    resultDigestSha256,
    metrics:overall,
    environment:historyInput?.environment??null,
    timestamp:historyInput?.timestamp??null,
  });
  return Object.freeze({
    format:FURY_EVAL_REPORT_FORMAT,
    datasetId:id,
    datasetVersion:dataset.version,
    datasetDigestSha256,
    resultDigestSha256,
    cases:frozenCases,
    overall,
    byDomain:frozenByDomain,
    history,
    executionAuthorized:false,
  });
}

function deltaNullable(candidate:number|null,baseline:number|null):number|null{
  return candidate===null||baseline===null?null:round(candidate-baseline);
}

export function compareFuryEvalReports(baseline:FuryEvalReport,candidate:FuryEvalReport,options:{readonly tolerance?:number}={}):FuryEvalComparison{
  if(!baseline||baseline.format!==FURY_EVAL_REPORT_FORMAT||!candidate||candidate.format!==FURY_EVAL_REPORT_FORMAT) throw new Error('valid FuryEval reports are required');
  const tolerance=options.tolerance??0;
  if(typeof tolerance!=='number'||!Number.isFinite(tolerance)||tolerance<0||tolerance>1) throw new Error('tolerance must be between 0 and 1');
  const comparable=baseline.datasetId===candidate.datasetId
    && baseline.datasetVersion===candidate.datasetVersion
    && baseline.datasetDigestSha256===candidate.datasetDigestSha256;
  const deltas=Object.freeze({
    successRate:round(candidate.overall.successRate-baseline.overall.successRate),
    precision:round(candidate.overall.precision-baseline.overall.precision),
    recall:round(candidate.overall.recall-baseline.overall.recall),
    f1:round(candidate.overall.f1-baseline.overall.f1),
    meanLatencyMs:deltaNullable(candidate.overall.meanLatencyMs,baseline.overall.meanLatencyMs),
    meanCostUsd:deltaNullable(candidate.overall.meanCostUsd,baseline.overall.meanCostUsd),
  });
  const regressions:string[]=[];
  const improvements:string[]=[];
  if(comparable){
    for(const metric of ['successRate','precision','recall','f1'] as const){
      const value=deltas[metric];
      if(value < -tolerance) regressions.push(`${metric} ${value}`);
      else if(value > tolerance) improvements.push(`${metric} +${value}`);
    }
    if(deltas.meanLatencyMs!==null){
      if(deltas.meanLatencyMs>0) regressions.push(`meanLatencyMs +${deltas.meanLatencyMs}`);
      else if(deltas.meanLatencyMs<0) improvements.push(`meanLatencyMs ${deltas.meanLatencyMs}`);
    }
    if(deltas.meanCostUsd!==null){
      if(deltas.meanCostUsd>0) regressions.push(`meanCostUsd +${deltas.meanCostUsd}`);
      else if(deltas.meanCostUsd<0) improvements.push(`meanCostUsd ${deltas.meanCostUsd}`);
    }
  }
  return Object.freeze({
    format:FURY_EVAL_COMPARISON_FORMAT,
    baselineDigestSha256:digest(baseline),
    candidateDigestSha256:digest(candidate),
    baselineResultDigestSha256:baseline.resultDigestSha256,
    candidateResultDigestSha256:candidate.resultDigestSha256,
    comparable,
    deltas,
    regressions:Object.freeze(regressions),
    improvements:Object.freeze(improvements),
    executionAuthorized:false,
  });
}
