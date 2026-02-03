import { 
  OrchestrationResult, 
  OrchestrationContext,
  MicroserviceResult
} from './types/microserviceTypes';
import { validateCNPJ } from './1-cadastral/cnpjValidator';
import { searchOperationalData } from './2-intelligence/operationalIntelligence';
import { searchOrganizationalData } from './2-intelligence/organizationalIntelligence';
import { mapCorporateNetwork } from './2-intelligence/corporateNetwork';
import { searchRevenue } from './2-intelligence/revenueSearcher';

export async function runBasicAudit(
  cnpj: string, 
  razaoSocial: string,
  callbacks?: { onProgress?: (service: string, msg: string) => void }
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const results = new Map<string, MicroserviceResult<any>>();
  const abortController = new AbortController();

  const context: OrchestrationContext = {
    leadId: `audit-${Date.now()}`,
    cnpj,
    razaoSocial,
    results,
    onProgress: (service, msg) => callbacks?.onProgress?.(service, msg),
    onComplete: (service, result) => results.set(service, result),
    onError: (service, error) => console.error(`[${service}] Error: ${error}`),
    abortController
  };

  let servicesRun = 0;
  let servicesFailed = 0;
  let servicesSkipped = 0;

  try {
    // 1. Run CNPJ Validator
    console.log('🚀 Executando cnpjValidator...');
    const cnpjResult = await validateCNPJ(context);
    results.set('cnpjValidator', cnpjResult);
    context.onComplete('cnpjValidator', cnpjResult);
    servicesRun++;

    if (cnpjResult.status === 'failed') {
      servicesFailed++;
      console.log('❌ cnpjValidator falhou:', cnpjResult.error);
    } else {
      console.log('✅ cnpjValidator concluído');
    }

    // 2. Run Operational Intelligence
    console.log('🚀 Executando operationalIntelligence...');
    const opResult = await searchOperationalData(context);
    results.set('operationalIntelligence', opResult);
    context.onComplete('operationalIntelligence', opResult);
    servicesRun++;

    if (opResult.status === 'skipped') {
      servicesSkipped++;
      console.log('⏭️ operationalIntelligence pulado');
    } else if (opResult.status === 'failed') {
      servicesFailed++;
      console.log('❌ operationalIntelligence falhou:', opResult.error);
    } else {
      console.log('✅ operationalIntelligence concluído');
    }

    // 3. Run Organizational Intelligence
    console.log('🚀 Executando organizationalIntelligence...');
    const orgResult = await searchOrganizationalData(context);
    results.set('organizationalIntelligence', orgResult);
    context.onComplete('organizationalIntelligence', orgResult);
    servicesRun++;

    if (orgResult.status === 'skipped') {
      servicesSkipped++;
      console.log('⏭️ organizationalIntelligence pulado');
    } else if (orgResult.status === 'failed') {
      servicesFailed++;
      console.log('❌ organizationalIntelligence falhou:', orgResult.error);
    } else {
      console.log('✅ organizationalIntelligence concluído');
    }

    // 4. Run Revenue Searcher
    console.log('🚀 Buscando faturamento real (revenueSearcher)...');
    const revenueData = await searchRevenue(context);
    const revenueResult: MicroserviceResult<any> = {
        status: 'completed',
        data: revenueData,
        error: null,
        duration: 0,
        logs: [`Faturamento: ${revenueData.isEstimated ? 'ESTIMADO' : 'REAL'}`],
        confidence: revenueData.confidence,
        sources: revenueData.source ? [revenueData.source] : [],
        timestamp: Date.now()
    };
    results.set('revenueSearcher', revenueResult);
    context.onComplete('revenueSearcher', revenueResult);
    servicesRun++;

    console.log('💰 Resultado do faturamento:', {
      valor: revenueData.revenue,
      real: !revenueData.isEstimated,
      fonte: revenueData.source,
      confiança: revenueData.confidence,
      raciocínio: revenueData.reasoning
    });

    // 5. Run Corporate Network
    console.log('🚀 Executando corporateNetwork...');
    const networkResult = await mapCorporateNetwork(context);
    results.set('corporateNetwork', networkResult);
    context.onComplete('corporateNetwork', networkResult);
    servicesRun++;

    if (networkResult.status === 'completed') {
      console.log('✅ corporateNetwork concluído');
    } else if (networkResult.status === 'failed') {
      servicesFailed++;
      console.log('❌ corporateNetwork falhou');
    }

    // 6. Future: Run Corporate Analyzer
    // const corpResult = await analyzeCorporateStructure(context);
    // results.set('corporateAnalyzer', corpResult);

    return {
      success: cnpjResult.status === 'completed', 
      results,
      errors: Array.from(results.entries())
        .filter(([_, res]) => res.status === 'failed' && res.error)
        .map(([name, res]) => ({ serviceName: name, error: res.error! })),
      duration: Date.now() - startTime,
      servicesRun,
      servicesFailed,
      servicesSkipped
    };
  } catch (error: any) {
    console.error('❌ Erro fatal no orquestrador:', error);
    return {
      success: false,
      results,
      errors: [{ serviceName: 'orchestrator', error: error.message || 'Unknown error' }],
      duration: Date.now() - startTime,
      servicesRun,
      servicesFailed: servicesFailed + 1,
      servicesSkipped
    };
  }
}