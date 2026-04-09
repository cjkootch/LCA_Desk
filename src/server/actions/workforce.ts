// Workforce domain: employees, talent pool, job postings, applications, seeker portal
export {
  // Employees
  fetchEmployees, addEmployee, updateEmployee, deleteEmployee,
  // Suppliers (filer-side directory)
  fetchSuppliers, addSupplier, updateSupplier, deleteSupplier,
  // Job postings
  fetchJobPostings, addJobPosting, updateJobPosting, deleteJobPosting,
  closeJobPosting, reopenJobPosting, fetchJobDetail,
  fetchApplicationCounts,
  // Applications
  fetchApplicationsForPosting, updateApplicationStatus, hireApplicant, applyToJob,
  // Talent pool
  fetchTalentPool, toggleProfileVisibility,
  // Smart matching
  fetchMatchedOpportunities,
  // Seeker portal
  fetchSeekerDashboardStats, updateMyProfile, fetchMyProfile, fetchMyApplications,
  fetchSeekerOpportunities, saveOpportunity, unsaveOpportunity,
  fetchSavedOpportunities, fetchMySavedOpportunities,
  seekerSaveOpportunity, seekerUnsaveOpportunity,
  // Seeker jobs
  fetchPublicJobs, seekerSaveJob, seekerUnsaveJob, fetchMySavedJobs,
  // LCS jobs
  fetchLcsJobs,
  // Upgrade supplier to filer
  upgradeSupplierToFiler,
} from "./_all";
