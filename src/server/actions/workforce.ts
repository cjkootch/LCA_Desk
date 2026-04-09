// Workforce domain: employees, talent pool, job postings, applications, seeker
export {
  // Employees
  fetchEmployees, addEmployee, updateEmployee, deleteEmployee,
  // Suppliers (filer-side directory)
  fetchSuppliers, addSupplier, updateSupplier, deleteSupplier,
  // Job postings
  fetchJobPostings, createJobPosting, updateJobPosting, deleteJobPosting,
  // Applications
  fetchJobApplications, updateApplicationStatus, hireApplicant,
  // Talent pool
  fetchTalentPool, toggleProfileVisibility,
  // Smart matching
  fetchSmartMatches,
  // Seeker portal
  fetchSeekerDashboardStats, updateMyProfile, fetchMyApplications,
  fetchSeekerOpportunities, saveOpportunity, unsaveOpportunity, fetchSavedItems,
  // Seeker jobs
  fetchSeekerJobs, saveJob, unsaveJob, fetchSavedJobs,
  // LCS jobs
  fetchLcsJobs,
  // Upgrade supplier to filer
  upgradeSupplierToFiler,
} from "./_all";
