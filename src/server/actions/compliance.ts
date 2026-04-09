// Compliance domain: entities, periods, expenditure, employment, capacity, narratives, submission
export {
  // Entities
  fetchEntities, fetchEntity, addEntity, updateEntity,
  // Reporting periods
  fetchPeriodsForEntity, fetchPeriod, addPeriod, duplicatePeriod,
  // Submission workflow
  updatePeriodStatus, attestAndSubmit, submitWithUpload,
  markPeriodSubmitted, checkPeriodLocked, reopenPeriod,
  // Expenditure
  fetchExpenditures, addExpenditure, removeExpenditure, updateExpenditure,
  // Employment
  fetchEmployment, addEmployment, removeEmployment, updateEmploymentRecord,
  // Capacity development
  fetchCapacity, addCapacity, removeCapacity, updateCapacityRecord,
  // Narratives
  fetchNarratives, saveNarrative,
  // Categories
  fetchCategories,
  // Audit
  fetchAuditLog,
  // Compliance health
  fetchComplianceHealth,
  // Compliance analytics
  fetchComplianceAnalytics,
  // Step completion
  fetchStepCompletion,
  // Jurisdiction helpers
  getEntityJurisdictionCode, getTenantJurisdictionCode, fetchJurisdictions,
  // Payment log
  addPaymentLog, fetchPaymentLog, fetchPaymentLogStats,
  // Stakeholders
  fetchStakeholders, updateStakeholders,
  // First consideration
  generateFirstConsiderationRecord,
} from "./_all";
