// Admin domain: super admin stats, ticket management, PLG analytics, course management
export {
  fetchAdminStats, fetchAllTickets, adminReplyToTicket, adminUpdateTicketStatus,
  fetchPlgStats, fetchDemoAccessLog, fetchTenantUsers, toggleUserDemo,
  fetchAdminCourses, fetchCourseModulesByAdmin, createCourse, updateCourse, addModule, updateModule, deleteModule,
} from "./_all";
