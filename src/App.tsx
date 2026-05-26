import React, { useState, useEffect } from "react";
import { 
  ExternalLink, 
  Plus, 
  Trash2, 
  Search, 
  User, 
  Lock, 
  LogOut, 
  Globe, 
  Sparkles, 
  Check, 
  Copy, 
  ShieldAlert, 
  Layers, 
  Filter, 
  Mail, 
  Users, 
  CheckCircle, 
  Send, 
  RefreshCw, 
  PlusCircle,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  ChevronRight,
  ShieldCheck,
  Award,
  Loader2,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link as PortalLink, Employee } from "./types";

export default function App() {
  // Theme management - default is light with superior yellow highlights
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("callbox_theme");
    return (saved === "dark" ? "dark" : "light");
  });

  useEffect(() => {
    localStorage.setItem("callbox_theme", theme);
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  }, [theme]);

  // Session details
  const [currentUser, setCurrentUser] = useState<{ email: string; role: "employee" | "admin" | "inactive" } | null>(null);
  const [isAdminViewInPortal, setIsAdminViewInPortal] = useState<boolean>(false);
  
  // Login form values
  const [loginTab, setLoginTab] = useState<"employee" | "admin">("employee");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePasscode, setEmployeePasscode] = useState("");
  const [showEmployeePasscode, setShowEmployeePasscode] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Portal data fetched from API
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Database status states
  const [isMySqlActive, setIsMySqlActive] = useState<boolean>(false);
  const [dbHost, setDbHost] = useState<string>("127.0.0.1");
  const [dbName, setDbName] = useState<string>("callbox_davao");
  const [dbPort, setDbPort] = useState<number>(3306);

  // Filter & Search
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Links form state (used by employee/admin to add link)
  const [linkForm, setLinkForm] = useState({
    title: "",
    url: "",
    description: "",
    category: "General",
    forInactive: false
  });
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [isScanningLink, setIsScanningLink] = useState(false);
  const [linkFormOpen, setLinkFormOpen] = useState(false);

  // Employee creation state (Admin view)
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState<"viewer" | "admin">("viewer");
  const [newEmployeePasscode, setNewEmployeePasscode] = useState("123456789");
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false);

  // Notifications (Toasts)
  const [toasts, setToasts] = useState<{ id: string; type: "success" | "error" | "info"; message: string }[]>([]);

  // Live clock state for Davao / PHT (UTC +8)
  const [timeStr, setTimeStr] = useState("12:00:00 PM PHT");
  const [dateStr, setDateStr] = useState("Davao, Philippines");

  // Show Toast notification
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Clock updates every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Calculate Davao Time (UTC+8)
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const davaoTime = new Date(utc + (3600000 * 8));

      // Format Time
      let hours = davaoTime.getHours();
      const minutes = davaoTime.getMinutes();
      const seconds = davaoTime.getSeconds();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour "0" is formatted as "12"
      const hourStr = hours < 10 ? '0' + hours : hours;
      const minStr = minutes < 10 ? '0' + minutes : minutes;
      const secStr = seconds < 10 ? '0' + seconds : seconds;
      
      setTimeStr(`${hourStr}:${minStr}:${secStr} ${ampm} PHT`);

      // Format Date
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      };
      setDateStr(davaoTime.toLocaleDateString('en-US', options));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all database records
  const fetchPortalData = async () => {
    setIsLoadingData(true);
    try {
      const res = await fetch("/api/portal-data");
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);
        setEmployees(data.employees || []);
        setIsMySqlActive(!!data.isMySqlActive);
        setDbHost(data.dbHost || "127.0.0.1");
        setDbName(data.dbName || "callbox_davao");
        setDbPort(Number(data.dbPort || 3306));
      } else {
        showToast("Using local backup simulation state", "info");
      }
    } catch (err) {
      console.error("Failed to fetch server data, utilizing local persistence", err);
      // Fallback defaults
      setLinks([]);
      setEmployees([
        { email: "hr@callboxinc.com", addedAt: new Date().toISOString(), role: "admin", passcode: "123456789" },
        { email: "admin_davao@callboxinc.com", addedAt: new Date().toISOString(), role: "admin", passcode: "123456789" }
      ]);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchPortalData();

    // Recover login session if stored
    const cachedSession = localStorage.getItem("callbox_session");
    if (cachedSession) {
      try {
        const parsed = JSON.parse(cachedSession);
        setCurrentUser(parsed);
        if (parsed.role === "admin") {
          setIsAdminViewInPortal(true);
        }
      } catch (e) {
        localStorage.removeItem("callbox_session");
      }
    }
  }, []);

  // Handle Employee Login
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const trimmedEmail = employeeEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      setLoginError("Please enter your official work email address.");
      return;
    }

    // Restriction check (@callboxinc.com only)
    if (!trimmedEmail.endsWith("@callboxinc.com")) {
      setLoginError("Access Restricted: This portal is strictly for employees with @callboxinc.com emails.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const session = { email: trimmedEmail, role: data.user.role };
        setCurrentUser(session);
        localStorage.setItem("callbox_session", JSON.stringify(session));
        if (session.role === "admin") {
          setIsAdminViewInPortal(true);
        }
        showToast("Credentials Confirmed. Welcome back to Callbox Davao Portal Dashboard!", "success");
        setEmployeeEmail("");
        setEmployeePasscode("");
        setAdminUser("");
        setAdminPass("");
        setLoginError("");
      } else {
        setLoginError(data.error || "Login authorization failed.");
      }
    } catch (err) {
      // Offline fallback login validation
      console.warn("Auth server offline, performing client check");
      const registeredEmp = employees.find(emp => emp.email.toLowerCase() === trimmedEmail);
      const isRegistered = !!registeredEmp;
      const isDefaultHR = trimmedEmail === "hr@callboxinc.com";

      if (isRegistered || isDefaultHR) {
        const resolvedRole = (registeredEmp?.role === "admin" || isDefaultHR) ? "admin" : "employee";
        const session = { email: trimmedEmail, role: resolvedRole as "employee" | "admin" };
        setCurrentUser(session);
        localStorage.setItem("callbox_session", JSON.stringify(session));
        if (resolvedRole === "admin") {
          setIsAdminViewInPortal(true);
        }
        showToast("Authenticated via offline database verify.", "success");
        setEmployeeEmail("");
        setEmployeePasscode("");
        setAdminUser("");
        setAdminPass("");
        setLoginError("");
      } else {
        setLoginError(`Email '${trimmedEmail}' is not yet in the authorized employee database. Please log in as admin to append your record.`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!adminUser || !adminPass) {
      setLoginError("Administrative credentials cannot be empty.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUser, password: adminPass })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const session = { email: data.user.email || "admin@callboxinc.com", role: "admin" as const };
        setCurrentUser(session);
        setIsAdminViewInPortal(true);
        localStorage.setItem("callbox_session", JSON.stringify(session));
        showToast("Welcome Admin. System registers are fully unlocked.", "success");
        setEmployeeEmail("");
        setAdminUser("");
        setAdminPass("");
        setLoginError("");
      } else {
        setLoginError(data.error || "Invalid credentials.");
      }
    } catch (err) {
      const trimmedUser = adminUser.trim().toLowerCase();
      // Check hardcoded fallback
      if (trimmedUser === "admin" && adminPass === "123456789") {
        const session = { email: "admin@callboxinc.com", role: "admin" as const };
        setCurrentUser(session);
        setIsAdminViewInPortal(true);
        localStorage.setItem("callbox_session", JSON.stringify(session));
        showToast("Logged in successfully (Local backup server fallback)", "success");
        setEmployeeEmail("");
        setAdminUser("");
        setAdminPass("");
        setLoginError("");
      } else {
        // Also check if any local registered admin matches!
        const matchedAdmin = employees.find(
          emp => emp.email.toLowerCase() === trimmedUser && emp.role === "admin"
        );
        if (matchedAdmin && (matchedAdmin.passcode || "123456789") === adminPass) {
          const session = { email: matchedAdmin.email, role: "admin" as const };
          setCurrentUser(session);
          setIsAdminViewInPortal(true);
          localStorage.setItem("callbox_session", JSON.stringify(session));
          showToast("Welcome Admin. Authenticated via offline backup verify.", "success");
          setEmployeeEmail("");
          setAdminUser("");
          setAdminPass("");
          setLoginError("");
        } else {
          setLoginError("Invalid combination of administrative username or passcode.");
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Log out current user
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminViewInPortal(false);
    localStorage.removeItem("callbox_session");
    showToast("Session closed.", "info");
    setEmployeeEmail("");
    setAdminUser("");
    setAdminPass("");
    setLoginError("");
  };

  // Scan resource link automatically (heuristics + server-side Gemini)
  const handleScanLink = async () => {
    const rawUrl = linkForm.url.trim();

    if (!rawUrl) {
      showToast("Please enter a destination URL address first.", "error");
      return;
    }

    setIsScanningLink(true);
    showToast("Analyzing link structure and fetching metadata...", "info");

    try {
      const res = await fetch("/api/scan-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl })
      });

      if (res.ok) {
        const data = await res.json();
        setLinkForm(prev => ({
          ...prev,
          title: data.title || prev.title,
          category: data.category || prev.category,
          description: data.description || prev.description
        }));
        showToast(`Heuristic analysis complete: Suggesting values for "${data.title}"`, "success");
      } else {
        const errData = await res.json();
        showToast(errData.error || "Failed to scan link automatically.", "error");
      }
    } catch (err) {
      // Local fallback in case server failed or completely offline
      let fallbackCat = "General";
      if (/hr|payroll|benefits|biometric|salary|leave/i.test(rawUrl)) {
        fallbackCat = "HR & Benefits";
      } else if (/support|ticket|helpdesk|sys|it|tech|admin/i.test(rawUrl)) {
        fallbackCat = "IT Support";
      } else if (/pipeline|crm|leads|campaign|client|dialer|comms/i.test(rawUrl)) {
        fallbackCat = "Campaigns";
      } else if (/davao|operations|office|hub|desk|schedule|roster/i.test(rawUrl)) {
        fallbackCat = "Operations";
      } else if (/academy|training|learn|coach|course|class/i.test(rawUrl)) {
        fallbackCat = "Training";
      }

      let cleanHost = rawUrl.replace(/^https?:\/\//i, "").replace("www.", "").split("/")[0].split(".")[0];
      let suggestedTitle = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1) + " Portal";

      setLinkForm(prev => ({
        ...prev,
        title: suggestedTitle,
        category: fallbackCat,
        description: `Official regional Davao access portal for ${fallbackCat.toLowerCase()} links.`
      }));
      showToast("Applied smart local fallback indexing.", "success");
    } finally {
      setIsScanningLink(false);
    }
  };

  // Admin/Employee Adds Link
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.title || !linkForm.url) {
      showToast("Link Title and URL cannot be left empty.", "error");
      return;
    }

    // Format destination URL
    let formattedUrl = linkForm.url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setIsSubmittingLink(true);
    const addedByUser = currentUser ? currentUser.email : "system@callboxinc.com";

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "employee"
        },
        body: JSON.stringify({
          title: linkForm.title.trim(),
          url: formattedUrl,
          description: linkForm.description.trim(),
          category: linkForm.category,
          addedBy: addedByUser,
          forInactive: linkForm.forInactive
        })
      });

      if (res.ok) {
        showToast("New link indexed and broadcasted!", "success");
        setLinkForm({ title: "", url: "", description: "", category: "General", forInactive: false });
        setLinkFormOpen(false);
        fetchPortalData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to commit link record.", "error");
      }
    } catch (err) {
      // Offline fallback
      const mockLink: PortalLink = {
        id: "l_" + Date.now(),
        title: linkForm.title,
        url: formattedUrl,
        description: linkForm.description,
        category: linkForm.category,
        addedBy: addedByUser,
        createdAt: new Date().toISOString(),
        forInactive: linkForm.forInactive
      };
      setLinks(prev => [mockLink, ...prev]);
      setLinkForm({ title: "", url: "", description: "", category: "General", forInactive: false });
      setLinkFormOpen(false);
      showToast("Link captured inside regional browser state.", "success");
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // Remove/Delete a Link
  const handleDeleteLink = async (id: string) => {
    try {
      const res = await fetch(`/api/links/${id}`, { 
        method: "DELETE",
        headers: {
          "x-user-role": currentUser?.role || "employee"
        }
      });
      if (res.ok) {
        showToast("Resource index deleted successfully", "success");
        fetchPortalData();
      } else {
        const data = await res.json();
        showToast(data.error || "Could not delete resource", "error");
      }
    } catch (err) {
      setLinks(prev => prev.filter(l => l.id !== id));
      showToast("Resource stripped from local state", "success");
    }
  };

  // Admin Registers Employee Email (Method 2)
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmployeeEmail.trim().toLowerCase();

    if (!cleanEmail) {
      showToast("Please supply the employee's email.", "error");
      return;
    }

    // Confirm Domain Restriction
    if (!cleanEmail.endsWith("@callboxinc.com")) {
      showToast("Must terminate with @callboxinc.com domain suffix.", "error");
      return;
    }

    setIsSubmittingEmployee(true);
    const finalPasscode = newEmployeeRole === "viewer"
      ? Math.floor(1000 + Math.random() * 9000).toString()
      : newEmployeePasscode;

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "employee"
        },
        body: JSON.stringify({ email: cleanEmail, role: newEmployeeRole, passcode: finalPasscode })
      });

      if (res.ok) {
        showToast(`Authorized Email Granted: ${cleanEmail} (${newEmployeeRole === "admin" ? "Admin Panel" : "Viewer Only"}) with passcode: ${finalPasscode}`, "success");
        setNewEmployeeEmail("");
        setNewEmployeeRole("viewer");
        setNewEmployeePasscode("123456789");
        fetchPortalData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to register employee authorized email.", "error");
      }
    } catch (err) {
      const exists = employees.some(emp => emp.email.toLowerCase() === cleanEmail);
      if (exists) {
        showToast("Employee email has already been grandfathered.", "error");
      } else {
        const newEmp: Employee = { email: cleanEmail, addedAt: new Date().toISOString(), role: newEmployeeRole, passcode: finalPasscode };
        setEmployees(prev => [newEmp, ...prev]);
        setNewEmployeeEmail("");
        setNewEmployeeRole("viewer");
        setNewEmployeePasscode("123456789");
        showToast(`Allowed: ${cleanEmail} (Simulated Persistence with passcode ${finalPasscode})`, "success");
      }
    } finally {
      setIsSubmittingEmployee(false);
    }
  };

  // Admin Revokes Employee Email (Method 2 delete)
  const handleDeleteEmployee = async (email: string) => {
    if (email.toLowerCase() === "hr@callboxinc.com") {
      showToast("This default HR account cannot be deleted for testing feasibility.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(email)}`, { 
        method: "DELETE",
        headers: {
          "x-user-role": currentUser?.role || "employee"
        }
      });
      if (res.ok) {
        showToast("Employee access credentials successfully revoked.", "success");
        fetchPortalData();
      } else {
        const data = await res.json();
        showToast(data.error || "Access revoke transaction failed.", "error");
      }
    } catch (err) {
      setEmployees(prev => prev.filter(emp => emp.email.toLowerCase() !== email.toLowerCase()));
      showToast("Credentials severed from offline system state.", "success");
    }
  };

  // Copy Link utility with browser check
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast("URL address copied to clipboard!", "success");
  };

  // Filter & Search links logic
  const filteredLinks = links.filter(link => {
    if (currentUser?.role === "inactive" && !link.forInactive) {
      return false;
    }
    const matchesCategory = categoryFilter === "All" || link.category === categoryFilter;
    const matchesQuery = 
      link.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (link.description && link.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      link.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className={`relative min-h-screen flex flex-col font-sans selection:bg-[#ffaa00]/40 selection:text-white pb-12 overflow-x-hidden transition-all duration-300 ${theme === "dark" ? "bg-[#050505] text-[#f0f0f0]" : "bg-gradient-to-br from-[#ffffeb] via-[#ffcc00] to-[#b88600] text-[#0c0a09]"}`}>
      
      {/* Modern award-style background elements for Light theme */}
      {theme === "light" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {/* Circular badge design backdrop / Art deco target circles */}
          <div className="absolute top-[15%] right-[-8%] w-[650px] h-[650px] opacity-[0.16] border-[1.5px] border-zinc-900 rounded-full flex items-center justify-center">
            <div className="w-[480px] h-[480px] border-[1.5px] border-zinc-900 rounded-full flex items-center justify-center">
              <div className="w-[320px] h-[320px] border-[1.5px] border-zinc-900 rounded-full flex items-center justify-center">
                <div className="w-[160px] h-[160px] border-[1.5px] border-zinc-900 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-[8%] left-[-12%] w-[550px] h-[550px] opacity-[0.14] border-[1.5px] border-zinc-900 rounded-full flex items-center justify-center">
            <div className="w-[380px] h-[380px] border-[1.5px] border-zinc-900 rounded-full flex items-center justify-center">
              <div className="w-[220px] h-[220px] border-[1.5px] border-zinc-900 rounded-full"></div>
            </div>
          </div>

          {/* Elegant geometric vertical/horizontal line frames */}
          <div className="absolute left-10 top-0 bottom-0 w-px bg-zinc-900/10 hidden xl:block"></div>
          <div className="absolute right-10 top-0 bottom-0 w-px bg-zinc-900/10 hidden xl:block"></div>
          
          {/* Subtle watermarked "SPECIAL SELECTION" branding text vertically placed on side margins */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 rotate-90 origin-left text-[8px] font-accent uppercase tracking-[0.6em] text-zinc-900/35 font-extrabold hidden xl:block">
            Callbox Davao Site Directory • Outstanding Corporate Portal
          </div>
          <div className="absolute right-[0px] top-1/2 -translate-y-1/2 -rotate-90 origin-right text-[8px] font-accent uppercase tracking-[0.6em] text-zinc-900/35 font-extrabold hidden xl:block">
            Website of the Year Special Edition • Authorized Staff Access
          </div>

          {/* Giant light-theme award stars/medals icons subtle silhouettes in background */}
          <div className="absolute top-[18%] left-[6%] w-[120px] h-[120px] text-zinc-950/5 select-none touch-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="absolute bottom-[25%] right-[6%] w-[140px] h-[140px] text-zinc-950/5 select-none touch-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full">
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
          </div>
        </div>
      )}

      {/* Modern award-style background elements for Dark theme */}
      {theme === "dark" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {/* Circular badge design backdrop / Art deco target circles in gold on dark */}
          <div className="absolute top-[15%] right-[-8%] w-[650px] h-[650px] opacity-[0.6] border-[1.5px] border-[#ffcc00]/35 rounded-full flex items-center justify-center animate-pulse-slow">
            <div className="w-[480px] h-[480px] border-[1.5px] border-[#ffcc00]/30 rounded-full flex items-center justify-center">
              <div className="w-[320px] h-[320px] border-[1.5px] border-[#ffcc00]/25 rounded-full flex items-center justify-center">
                <div className="w-[160px] h-[160px] border-[1.5px] border-[#ffcc00]/25 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-[8%] left-[-12%] w-[550px] h-[550px] opacity-[0.5] border-[1.5px] border-[#ffcc00]/30 rounded-full flex items-center justify-center">
            <div className="w-[380px] h-[380px] border-[1.5px] border-[#ffcc00]/25 rounded-full flex items-center justify-center">
              <div className="w-[220px] h-[220px] border-[1.5px] border-[#ffcc00]/25 rounded-full"></div>
            </div>
          </div>

          {/* Elegant geometric vertical/horizontal line frames in golden tint */}
          <div className="absolute left-10 top-0 bottom-0 w-px bg-[#ffcc00]/20 hidden xl:block"></div>
          <div className="absolute right-10 top-0 bottom-0 w-px bg-[#ffcc00]/20 hidden xl:block"></div>
          
          {/* Subtle watermarked "SPECIAL SELECTION" branding text vertically placed on side margins */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 rotate-90 origin-left text-[8px] font-accent uppercase tracking-[0.6em] text-[#ffcc00]/55 font-extrabold hidden xl:block">
            Callbox Davao Site Directory • Outstanding Corporate Portal
          </div>
          <div className="absolute right-[0px] top-1/2 -translate-y-1/2 -rotate-90 origin-right text-[8px] font-accent uppercase tracking-[0.6em] text-[#ffcc00]/55 font-extrabold hidden xl:block">
            Website of the Year Special Edition • Authorized Staff Access
          </div>

          {/* Giant dark-theme award stars/medals icons subtle silhouettes in background */}
          <div className="absolute top-[18%] left-[6%] w-[120px] h-[120px] text-[#ffcc00]/15 select-none touch-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="absolute bottom-[25%] right-[6%] w-[140px] h-[140px] text-[#ffcc00]/15 select-none touch-none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full">
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
          </div>
        </div>
      )}

      {/* Dynamic drifting gold background orbs matching Elegant Dark */}
      <div className={`absolute top-[-10%] left-[-15%] w-[60%] h-[50%] bg-gradient-to-br rounded-full blur-[180px] pointer-events-none animate-glow-slow-1 transition-all duration-300 ${theme === "dark" ? "from-[#ffaa00]/5 to-transparent" : "from-[#ffaa00]/12 to-transparent"}`}></div>
      <div className={`absolute bottom-[-5%] right-[-10%] w-[55%] h-[50%] bg-gradient-to-tr rounded-full blur-[160px] pointer-events-none animate-glow-slow-2 transition-all duration-300 ${theme === "dark" ? "from-[#00ffcc]/5 to-transparent" : "from-[#00ffcc]/8 to-transparent"}`}></div>

      {/* Modern line grid pattern */}
      <div className={`absolute top-0 left-0 w-full h-full pointer-events-none transition-all duration-300 ${
        theme === "dark" 
          ? "bg-[linear-gradient(to_right,rgba(255,170,0,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,170,0,0.015)_1px,transparent_1px)]"
          : "bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)]"
      } bg-[size:4.5rem_4.5rem]`}></div>

      {/* Floating Awwwards custom styled notifications */}
      <div className="fixed top-8 right-8 z-50 flex flex-col gap-3.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-full p-4 rounded-xl border border-white/15 bg-[#0a0a0a]/95 backdrop-blur-xl shadow-2xl flex gap-3.5 items-start glass-panel-glow"
            >
              {toast.type === "success" && <Check className="w-5 h-5 text-[#00ffcc] shrink-0 mt-0.5" />}
              {toast.type === "error" && <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
              {toast.type === "info" && <Sparkles className="w-5 h-5 text-[#ffaa00] shrink-0 mt-0.5" />}
              <div className="flex-grow">
                <p className="text-[#f0f0f0] text-xs font-semibold uppercase tracking-wider mb-0.5">
                  {toast.type === "success" ? "System Confirmed" : toast.type === "error" ? "Security Alert" : "System Indexer"}
                </p>
                <span className="text-zinc-400 text-[11px] leading-relaxed block font-medium">{toast.message}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Theme Toggle Switch with glass backdrop */}
      <div className="fixed top-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all duration-300 shadow-xl cursor-pointer ${
            theme === "dark"
              ? "bg-[#0a0a0a]/90 hover:bg-zinc-900 border-white/10 text-[#ffaa00]"
              : "bg-white/95 hover:bg-zinc-50 border-amber-500/30 text-[#ff9900]"
          }`}
          title={theme === "light" ? "Activate Dark Protocol" : "Restore Light Grid"}
        >
          {theme === "light" ? (
            <>
              <Moon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider font-accent">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-[#ff9900] shrink-0 animate-spin-slow" />
              <span className="text-[10px] font-bold uppercase tracking-wider font-accent">Light Mode</span>
            </>
          )}
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {!currentUser ? (
          /* Login View - Centered premium entry box */
          <motion.div
            key="login_gateway"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex-grow flex items-center justify-center px-6 py-20 relative z-20"
          >
            <div className="max-w-md w-full relative">
              {/* Golden neon halo frame behind the login box */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#ffaa00]/40 to-[#00ffcc]/30 rounded-2xl blur-xl opacity-30"></div>

              <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 sm:p-10 shadow-3xl text-left overflow-hidden">
                {/* Visual identity */}
                <div className="space-y-2 mb-8 text-center sm:text-left">
                  <div className="mb-4">
                    <span className="text-xs font-bold tracking-[0.3em] text-[#ffaa00] uppercase font-accent">
                      Callbox Davao
                    </span>
                  </div>
                  <h2 className="text-4xl font-display font-light tracking-tighter leading-none text-white">
                    Employee Portal
                  </h2>
                  <p className="text-zinc-400 text-xs tracking-wide pt-1 leading-relaxed">
                    Verify account status to browse exclusive directory guidelines, internal campaign links, and Davao site utilities.
                  </p>
                </div>

                {/* Secure Tab Selection */}
                <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl border border-white/5 mb-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setLoginTab("employee"); setLoginError(""); }}
                    className={`py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                      loginTab === "employee" 
                        ? "bg-zinc-900 text-white border border-white/10 shadow-lg font-bold" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Employee Login
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setLoginTab("admin"); setLoginError(""); }}
                    className={`py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                      loginTab === "admin" 
                        ? "bg-zinc-900 text-[#ffaa00] border border-white/10 shadow-lg font-bold" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Admin Panel
                  </motion.button>
                </div>

                {/* Error warning box */}
                {loginError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs flex gap-2.5 items-start mb-6"
                  >
                    <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-400" />
                    <span className="leading-relaxed font-accent">{loginError}</span>
                  </motion.div>
                )}

                {/* Interactive logical Login Forms */}
                {loginTab === "employee" ? (
                  <form onSubmit={handleEmployeeLogin} className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs uppercase tracking-wider text-white/50 font-accent font-semibold">
                        <span>Work Email Domain</span>
                        <span className="text-[#ffaa00] lowercase italic font-light">@callboxinc.com only</span>
                      </div>
                      
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="username@callboxinc.com"
                          value={employeeEmail}
                          onChange={(e) => setEmployeeEmail(e.target.value)}
                          className="w-full h-12 bg-zinc-900/60 rounded-xl border border-white/10 px-4 pl-11 text-sm text-white focus:outline-none focus:border-[#ffaa00] focus:ring-1 focus:ring-[#ffaa00]/25 transition-all font-sans"
                        />
                        <Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-4" />
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full h-12 bg-white hover:bg-[#ffaa00] text-black font-extrabold uppercase tracking-wider text-xs rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[#ffaa00]/20 disabled:opacity-50"
                    >
                      {isLoggingIn ? "Authenticating Session..." : "Enter Employee Portal"}
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </form>
                ) : (
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs uppercase tracking-wider text-white/50 font-accent font-semibold">
                        Admin Username
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="admin"
                          value={adminUser}
                          onChange={(e) => setAdminUser(e.target.value)}
                          className="w-full h-12 bg-zinc-900/60 rounded-xl border border-white/10 px-4 pl-11 text-sm text-white focus:outline-none focus:border-[#ffaa00] focus:ring-1 focus:ring-[#ffaa00]/25 transition-all font-sans"
                        />
                        <User className="w-4 h-4 text-zinc-500 absolute left-4 top-4" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs uppercase tracking-wider text-white/50 font-accent font-semibold">
                        Passcode Access
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="passcode"
                          value={adminPass}
                          onChange={(e) => setAdminPass(e.target.value)}
                          className="w-full h-12 bg-zinc-900/60 rounded-xl border border-white/10 pl-11 pr-11 text-sm text-white focus:outline-none focus:border-[#ffaa00] focus:ring-1 focus:ring-[#ffaa00]/25 transition-all font-sans"
                        />
                        <Lock className="w-4 h-4 text-zinc-500 absolute left-4 top-4" />
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-3.5 text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4.5 h-4.5" />
                          ) : (
                            <Eye className="w-4.5 h-4.5" />
                          )}
                        </motion.button>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full h-12 bg-[#ffaa00] hover:bg-[#ffaa00]/90 text-black font-extrabold uppercase tracking-wider text-xs rounded-xl transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-[#ffaa00]/20 disabled:opacity-50"
                    >
                      {isLoggingIn ? "Verifying Keys..." : "Launch Command Panel"}
                      <Lock className="w-4 h-4" />
                    </motion.button>
                  </form>
                )}

                <div className="h-px bg-white/5 my-6"></div>

                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-zinc-500 font-accent justify-center sm:justify-start">
                    <span>Inactive Employee ?</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => {
                      const session = { role: "inactive" as const, email: "inactive_guest@callboxinc.com" };
                      setCurrentUser(session);
                      localStorage.setItem("callbox_session", JSON.stringify(session));
                      showToast("Entered Portal in Inactive View. Only specific links will be viewable.", "success");
                    }}
                    className="w-full h-11 border border-teal-500/20 hover:border-teal-500/85 bg-teal-500/5 hover:bg-teal-500/10 text-[#00ffcc] font-bold uppercase tracking-wider text-[11px] rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-teal-500/10"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Access Inactive Employee View
                  </motion.button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-600">
                  <span className="uppercase tracking-widest font-accent">Site Area Davao</span>
                  <span>SSL SECURE • 256-BIT</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Logged In Web Portal - Split Layout inspired by the Design HTML */
          <motion.div
            key="dashboard_viewport"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-grow flex flex-col lg:flex-row w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 gap-6 relative z-10"
          >
            {/* Sidebar (ASIDE CONTAINER) strictly configured to matching the Elegant Dark scheme */}
            <aside className="w-full lg:w-80 border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl rounded-2xl flex flex-col p-6 sm:p-8 justify-between shrink-0 glass-panel">
              <div className="space-y-10">
                
                {/* Brand Identity Headings from Design HTML */}
                <div className="space-y-2 border-b border-white/5 pb-4">
                  <h1 className="text-xs font-bold tracking-[0.3em] text-[#ffaa00] uppercase font-accent">
                    Callbox Davao
                  </h1>
                  <p className="text-3xl font-light tracking-tighter leading-none text-white font-display">
                    Employee Portal
                  </p>
                </div>

                {/* Premium Golden Award Badge sticker */}
                <div className={`p-4 rounded-xl border flex items-center gap-3.5 transition-all duration-300 ${
                  theme === "light" 
                    ? "bg-[#ffaa00]/15 border-zinc-950 text-zinc-900 shadow-[3px_3px_0px_0px_rgba(12,10,9,1)] hover:shadow-[5px_5px_0px_0px_rgba(12,10,9,1)] hover:-translate-y-0.5"
                    : "bg-[#ffaa00]/5 border-amber-500/20 text-zinc-300"
                }`}>
                  <div className={`p-2.5 rounded-lg shrink-0 ${theme === "light" ? "bg-zinc-950 text-[#ffaa00]" : "bg-zinc-900 text-[#ffaa00]"}`}>
                    <Award className="w-5 h-5 text-[#ffaa00]" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[9px] uppercase tracking-widest font-extrabold leading-none mb-1 ${theme === "light" ? "text-zinc-950" : "text-[#ffaa00]"}`}>Special Edition</p>
                    <p className="text-[11px] font-accent font-bold leading-tight truncate">Award-Winning Portal UI</p>
                  </div>
                </div>

                {/* Session Active Account info */}
                <div className="space-y-6">
                  <div className="group">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-2 font-accent font-semibold">
                      Current Identity
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00ffcc] animate-pulse"></div>
                      <span className="text-xs sm:text-sm font-medium italic text-zinc-200 truncate block">
                        {currentUser.email}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold border ${
                        currentUser.role === "admin" 
                          ? "bg-[#ffaa00]/10 text-[#ffaa00] border-[#ffaa00]/15" 
                          : currentUser.role === "inactive"
                            ? "bg-teal-500/10 text-teal-400 border-teal-500/15"
                            : "bg-[#00ffcc]/10 text-[#00ffcc] border-[#00ffcc]/15"
                      }`}>
                        {currentUser.role === "admin" 
                          ? "Systems Administrator" 
                          : currentUser.role === "inactive"
                            ? "Inactive Employee (Restricted)"
                            : "Active Employee"}
                      </span>
                      <p className="text-[9px] text-white/20 uppercase tracking-tighter italic">
                        {currentUser.role === "inactive" ? "Restricted isolated view" : "Domain restriction active"}
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-white/5"></div>

                  {/* Left Sidebar Active Section indicators & lists */}
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-accent font-semibold block mb-0.5">
                      Navigation & Modes
                    </p>

                    <motion.button
                      whileHover={{ scale: 1.01, x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                      className={`w-full py-3 px-4 rounded-xl text-left text-xs uppercase tracking-widest transition-all font-semibold flex items-center justify-between border cursor-pointer ${
                        theme === "dark" 
                          ? "bg-zinc-900/40 text-[#ffaa00] border-white/5 hover:bg-zinc-900 hover:text-[#ffaa00]"
                          : "bg-[#ffaa00]/10 text-[#ff9900] border-[#ffaa00]/25 hover:bg-[#ffaa00]/20"
                      }`}
                      title={theme === "light" ? "Switch to Dark Protocol" : "Switch to Light Mode"}
                    >
                      <span className="flex items-center gap-2">
                        {theme === "light" ? <Moon className="w-3.5 h-3.5 text-[#ff9900]" /> : <Sun className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
                        {theme === "light" ? "Go Dark Mode" : "Go Light Mode"}
                      </span>
                      <span className="text-[8px] font-mono font-bold bg-[#ffaa00]/10 text-[#ffaa00] px-1.5 py-0.5 rounded border border-[#ffaa00]/20">
                        {theme === "light" ? "LIGHT" : "DARK"}
                      </span>
                    </motion.button>
                    
                    {currentUser.role === "admin" ? (
                      <div className="flex flex-col gap-2">
                        <motion.button
                          whileHover={{ scale: 1.01, x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setIsAdminViewInPortal(true)}
                          className={`w-full py-3.5 px-4 rounded-xl text-left text-xs uppercase tracking-widest transition-all font-semibold flex items-center justify-between border cursor-pointer ${
                            isAdminViewInPortal 
                              ? "bg-[#ffaa00]/10 border-[#ffaa00] text-[#ffaa00]" 
                              : "bg-zinc-900/40 text-zinc-400 border-white/5 hover:bg-zinc-900 hover:text-white"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5" />
                            Admin Console
                          </span>
                          <ChevronRight className="w-3 h-3" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.01, x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setIsAdminViewInPortal(false)}
                          className={`w-full py-3.5 px-4 rounded-xl text-left text-xs uppercase tracking-widest transition-all font-semibold flex items-center justify-between border cursor-pointer ${
                            !isAdminViewInPortal 
                              ? "bg-white/5 border-white/25 text-white" 
                              : "bg-zinc-900/40 text-zinc-400 border-white/5 hover:bg-zinc-900 hover:text-white"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5" />
                            Portal Display
                          </span>
                          <ChevronRight className="w-3 h-3" />
                        </motion.button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 py-2 px-3 bg-zinc-950/40 border border-white/5 rounded-xl">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span className="text-[11px] text-zinc-400">Restricted site access verified</span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* Bottom logout and panel switcher matching UI specs */}
              <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                {currentUser.role === "admin" && !isAdminViewInPortal && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                    <p className="text-[9px] uppercase tracking-widest text-white/40 mb-2">Logged in as Administrator</p>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setIsAdminViewInPortal(true)}
                      className="w-full bg-[#ffaa00] text-black py-2.5 rounded-lg text-xs font-bold uppercase tracking-tighter hover:bg-[#ffaa00]/90 transition-colors cursor-pointer block"
                    >
                      Open Admin Controls
                    </motion.button>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleLogout}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-900 border border-white/5 hover:border-rose-950 hover:bg-rose-950/20 text-xs uppercase tracking-widest text-zinc-400 hover:text-rose-400 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </motion.button>
              </div>
            </aside>

            {/* Main view container rendered matching Awwwards feed */}
            <main className="flex-1 flex flex-col gap-6 min-w-0">
              <AnimatePresence mode="wait">
                
                {/* Screen 1: Admin Panel Screen */}
                {isAdminViewInPortal ? (
                  <motion.div
                    key="admin_editor_screen"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-6"
                  >
                    {/* Header bar designed elegantly */}
                    <div className="p-6 rounded-2xl border border-white/10 bg-[#0a0a0a] flex flex-col md:flex-row md:items-center justify-between gap-4 glow-box">
                      <div>
                        <div className="text-[10px] uppercase tracking-longest text-[#ffaa00] font-accent font-bold flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-[#ffaa00]" />
                          Administrative Roster & Resource Manager
                        </div>
                        <h2 className="text-3xl font-display font-light tracking-tight text-white mt-1">
                          System Director
                        </h2>
                      </div>
                      
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setIsAdminViewInPortal(false)}
                          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-xs uppercase tracking-widest text-zinc-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-[#ffaa00]" />
                          View Main Display
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05, rotate: 180 }}
                          whileTap={{ scale: 0.93 }}
                          transition={{ type: "spring", stiffness: 200, damping: 10 }}
                          onClick={fetchPortalData}
                          className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
                          title="Refresh Database Records"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>

                    {/* Stats bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a] glow-box">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-accent">Total Links</span>
                        <h4 className="text-2xl font-light font-display text-white mt-1">{links.length}</h4>
                      </div>
                      <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a] glow-box">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-accent">Authorized Users</span>
                        <h4 className="text-2xl font-light font-display text-[#ffaa00] mt-1">{employees.length}</h4>
                      </div>
                      <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a] glow-box">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-accent">Allowed Domain</span>
                        <h4 className="text-[11px] font-bold font-mono text-[#00ffcc] mt-1 pr-1 truncate">@callboxinc.com</h4>
                      </div>
                      <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a] glow-box">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-accent">Security SSL</span>
                        <h4 className="text-xs font-semibold text-zinc-300 mt-1 uppercase italic flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#00ffcc] inline-block"></span>
                          Operational
                        </h4>
                      </div>
                    </div>

                    {/* TWO Separate Create Methods matching specifications */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                      
                      {/* Create Method 1: New links added to display */}
                      <div className="xl:col-span-7 space-y-6">
                        <div className="p-6 rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-xl relative overflow-hidden glow-box">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-display font-medium text-white tracking-tight mt-1">Publish Resource Link</h3>
                            </div>
                            <Globe className="w-4.5 h-4.5 text-zinc-500" />
                          </div>

                          <form onSubmit={handleAddLink} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 font-accent uppercase tracking-wider">Title *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Davao Hub Portal"
                                  value={linkForm.title}
                                  onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-[#ffaa00] font-sans"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400 font-accent uppercase tracking-wider">Category *</label>
                                <select
                                  value={linkForm.category}
                                  onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })}
                                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-zinc-100 focus:outline-none focus:border-[#ffaa00] font-sans"
                                >
                                  <option value="Campaigns">Campaigns</option>
                                  <option value="Operations">Operations</option>
                                  <option value="HR & Benefits">HR & Benefits</option>
                                  <option value="IT Support">IT Support</option>
                                  <option value="Training">Training</option>
                                  <option value="General">General</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] text-zinc-400 font-accent uppercase tracking-wider font-semibold">Destination URL address *</label>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  type="button"
                                  onClick={handleScanLink}
                                  disabled={isScanningLink}
                                  className="text-[10px] text-[#ffaa00] hover:text-white disabled:text-zinc-600 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors focus:outline-none"
                                >
                                  {isScanningLink ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin text-[#ffaa00]" />
                                      Scanning...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3 h-3 text-[#ffaa00]" />
                                      Auto-Scan
                                    </>
                                  )}
                                </motion.button>
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. pipeline.callboxinc.com"
                                  value={linkForm.url}
                                  onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl pl-3 pr-24 text-xs text-white focus:outline-none focus:border-[#ffaa00] font-sans"
                                />
                                <div className="absolute right-1.5 top-1.5">
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={handleScanLink}
                                    disabled={isScanningLink}
                                    className="h-8 px-3 bg-[#ffaa00]/10 hover:bg-[#ffaa00]/20 text-[#ffaa00] disabled:opacity-50 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all focus:outline-none"
                                  >
                                    {isScanningLink ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-3 h-3" />
                                    )}
                                    Scan
                                  </motion.button>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-400 font-accent uppercase tracking-wider font-semibold">Supplemental Description</label>
                              <textarea
                                placeholder="Describe the main process or access guidelines..."
                                rows={2.5}
                                value={linkForm.description}
                                onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ffaa00] font-sans"
                              />
                            </div>

                            {/* Secure check for assigning permissions for Inactive users */}
                            <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-950/40 space-y-2">
                              {(() => {
                                const isAuthorizedForInactiveToggle = currentUser?.role === "admin" && (
                                  currentUser.email?.toLowerCase() === "hr@callboxinc.com" || 
                                  currentUser.email?.toLowerCase() === "admin_davao@callboxinc.com" ||
                                  currentUser.email?.toLowerCase() === "admin@callboxinc.com"
                                );
                                return (
                                  <>
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={!isAuthorizedForInactiveToggle}
                                        checked={linkForm.forInactive}
                                        onChange={(e) => setLinkForm({ ...linkForm, forInactive: e.target.checked })}
                                        className="rounded border-white/10 text-[#ffaa00] focus:ring-[#ffaa00] focus:ring-opacity-25 bg-zinc-900 w-4 h-4 disabled:opacity-40"
                                      />
                                      <span className={`text-[11px] font-bold uppercase tracking-wider ${!isAuthorizedForInactiveToggle ? 'text-zinc-500' : 'text-zinc-200'}`}>
                                        Make Link Available to Inactive Employees
                                      </span>
                                    </label>
                                    <p className="text-[9px] text-zinc-400 leading-normal font-sans">
                                      {isAuthorizedForInactiveToggle 
                                        ? "🛡️ Authorized: You are allowed to index this portal link to the restricted inactive employee workspace." 
                                        : "🔒 Restrict Mode: Only select administrators (e.g., HR/Site Admin) are authorized to assign links to inactive employees."}
                                    </p>
                                  </>
                                );
                              })()}
                            </div>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              type="submit"
                              disabled={isSubmittingLink}
                              className="h-11 px-6 bg-[#ffaa00] hover:bg-[#ffaa00]/90 text-black font-extrabold uppercase tracking-wider text-[11px] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              {isSubmittingLink ? "Broadcasting..." : "Index Resource Link"}
                              <Plus className="w-3.5 h-3.5" />
                            </motion.button>
                          </form>
                        </div>

                        {/* Registered links administrative registry list */}
                        <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/40">
                          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                            <h4 className="font-display font-medium text-white text-sm">Main Page Resource Records</h4>
                            <span className="text-[10px] font-accent text-zinc-400 uppercase bg-zinc-900 border border-white/10 px-2 py-0.5 rounded">
                              {links.length} Active Records
                            </span>
                          </div>

                          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                            {links.map((link, idx) => (
                              <div 
                                key={link.id}
                                className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a] hover:border-white/15 hover:bg-[#0d0d0d] transition-all flex items-center justify-between gap-4"
                              >
                                <div className="truncate min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="text-[9px] font-mono text-[#ffaa00]">
                                      {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                                    </span>
                                    <span className="text-[9px] font-accent uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 font-bold">
                                      {link.category}
                                    </span>
                                    {link.forInactive && (
                                      <span className="text-[8px] font-accent uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/15 font-bold">
                                        For Inactive
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="text-xs font-semibold text-zinc-100 truncate">{link.title}</h5>
                                  <a href={link.url} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-500 hover:text-[#ffaa00] truncate block mt-0.5">
                                    {link.url}
                                  </a>
                                </div>

                                <motion.button
                                  whileHover={{ scale: 1.1, rotate: 5 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDeleteLink(link.id)}
                                  className="p-2 bg-zinc-900 hover:bg-rose-950/50 hover:text-rose-400 text-zinc-500 rounded-lg transition-all border border-white/5 cursor-pointer"
                                  title="Strip Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Create Method 2: Create Authorized Users (Employee Emails) */}
                      <div className="xl:col-span-5 space-y-6">
                        <div className="p-6 rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-xl relative overflow-hidden glow-box">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-display font-medium text-white tracking-tight mt-1">Authorize Employee Email</h3>
                            </div>
                            <Users className="w-4.5 h-4.5 text-zinc-500" />
                          </div>

                          <form onSubmit={handleAddEmployee} className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-400 font-accent uppercase tracking-wider font-semibold block">
                                Work Address Username
                              </label>
                              
                              <div className="relative">
                                <input
                                  type="text"
                                  required
                                  placeholder="username"
                                  value={newEmployeeEmail.replace("@callboxinc.com", "")}
                                  onChange={(e) => {
                                    const baseVal = e.target.value.replace("@callboxinc.com", "");
                                    setNewEmployeeEmail(baseVal ? baseVal + "@callboxinc.com" : "");
                                  }}
                                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl pl-3 pr-28 text-xs text-white focus:outline-none focus:border-[#00ffcc] font-sans"
                                />
                                <div className="absolute right-2.5 top-3.5 text-[8px] font-accent uppercase tracking-widest font-bold px-1.5 py-0.5 border border-white/10 bg-zinc-950 rounded text-[#00ffcc]">
                                  @callboxinc.com
                                </div>
                              </div>
                              <p className="text-[9px] text-zinc-500 leading-normal pt-1.5">
                                Strictly whitelist active personnel credentials to bypass the site gates. Only emails listed on this index table can log in.
                              </p>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] text-zinc-400 font-accent uppercase tracking-wider font-semibold block">
                                Access Privilege Level
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  type="button"
                                  onClick={() => setNewEmployeeRole("viewer")}
                                  className={`py-2 px-3 h-10 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    newEmployeeRole === "viewer"
                                      ? "bg-zinc-900 border-[#00ffcc] text-[#00ffcc] font-extrabold"
                                      : "bg-[#030303]/30 border-white/5 text-zinc-400 hover:text-white"
                                  }`}
                                >
                                  Portal View Only
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  type="button"
                                  onClick={() => setNewEmployeeRole("admin")}
                                  className={`py-2 px-3 h-10 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    newEmployeeRole === "admin"
                                      ? "bg-[#ffaa00]/10 border-[#ffaa00] text-[#ffaa00] font-extrabold"
                                      : "bg-[#030303]/30 border-white/5 text-zinc-400 hover:text-white"
                                  }`}
                                >
                                  Admin Console
                                </motion.button>
                              </div>
                              <p className="text-[9px] text-zinc-500 leading-normal">
                                {newEmployeeRole === "admin" 
                                  ? "Authorized user can toggle to Admin Console, register other emails, and edit resource links."
                                  : "Authorized user can only view the main display dashboard (cannot enter the admin console)."}
                              </p>
                            </div>

                            {newEmployeeRole === "admin" && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] text-zinc-400 font-accent uppercase tracking-wider font-semibold block">
                                    Assign Passcode
                                  </label>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={() => {
                                      const rand = Math.floor(1000 + Math.random() * 9000).toString();
                                      setNewEmployeePasscode(rand);
                                      showToast(`Generated random passcode: ${rand}`, "success");
                                    }}
                                    className="text-[10px] text-[#ffaa00] hover:text-white transition-colors flex items-center gap-1 font-bold tracking-wider uppercase cursor-pointer focus:outline-none"
                                  >
                                    <Sparkles className="w-3 h-3 text-[#ffaa00]" />
                                    Randomize
                                  </motion.button>
                                </div>
                                <div className="relative">
                                  <input
                                    type="text"
                                    required
                                    placeholder="Enter passcode (e.g. 123456789)"
                                    value={newEmployeePasscode}
                                    onChange={(e) => setNewEmployeePasscode(e.target.value)}
                                    className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-[#ffaa00] font-sans"
                                  />
                                </div>
                                <p className="text-[9px] text-zinc-500 leading-normal pt-1.5">
                                  Set a custom passcode or click Randomize to assign a random passcode for the administrator.
                                </p>
                              </div>
                            )}

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              type="submit"
                              disabled={isSubmittingEmployee}
                              className="w-full h-11 bg-white hover:bg-[#00ffcc] hover:text-black text-black font-extrabold uppercase tracking-wider text-[11px] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              {isSubmittingEmployee ? "Synching..." : "Grant Active Authorization"}
                              <PlusCircle className="w-3.5 h-3.5" />
                            </motion.button>
                          </form>
                        </div>

                        {/* Whitelisted system personnel index table */}
                        <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/40">
                          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                            <h4 className="font-display font-medium text-zinc-300 text-sm">Authorized Corporate Access table</h4>
                            <span className="text-[10px] font-accent text-zinc-400 uppercase bg-zinc-900 border border-white/10 px-2 py-0.5 rounded">
                              {employees.length} Whitelisted
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                            {employees.map(emp => (
                              <div 
                                key={emp.email}
                                className="p-3.5 rounded-xl border border-white/5 bg-[#0a0a0a] hover:border-white/10 transition-all flex items-center justify-between gap-3"
                              >
                                <div className="truncate min-w-0">
                                  <p className="text-xs font-semibold text-zinc-300 truncate font-mono">{emp.email}</p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {emp.role === "admin" ? (
                                      <span className="text-[8px] uppercase tracking-widest text-[#ffaa00] inline-flex items-center gap-1 font-bold leading-none bg-[#ffaa00]/10 border border-[#ffaa00]/20 px-1.5 py-0.5 rounded">
                                        <Lock className="w-2 h-2" /> Admin Access
                                      </span>
                                    ) : (
                                      <span className="text-[8px] uppercase tracking-widest text-[#00ffcc] inline-flex items-center gap-1 font-bold leading-none bg-[#00ffcc]/10 border border-[#00ffcc]/20 px-1.5 py-0.5 rounded">
                                        <Globe className="w-2 h-2" /> View Only
                                      </span>
                                    )}
                                    <span className="text-[8px] uppercase tracking-widest text-[#ffaa00] inline-flex items-center gap-1 font-mono leading-none bg-zinc-900 border border-white/10 px-1.5 py-0.5 rounded">
                                      Pass: {emp.passcode || "123456789"}
                                    </span>
                                  </div>
                                </div>

                                <motion.button
                                  whileHover={{ scale: 1.1, rotate: 5 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDeleteEmployee(emp.email)}
                                  disabled={emp.email.toLowerCase() === "hr@callboxinc.com"}
                                  className="p-2 bg-zinc-900 hover:bg-rose-950/50 hover:text-rose-400 text-zinc-500 disabled:opacity-30 rounded-lg transition-all border border-white/5 cursor-pointer"
                                  title="Sever Permission"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>

                    </div>
                  </motion.div>
                ) : (
                  /* Screen 2: Main Display Feed (Employee Resource directory view) */
                  <motion.div
                    key="display_portal_screen"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-8"
                  >
                    {/* Display header structured to Design specs (Latest Updates vs Time block) */}
                    <div className="border-b border-white/10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-left">
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-[#ffaa00] font-accent font-bold block mb-1">
                          {currentUser?.role === "inactive" ? "Restricted Inactive Staff Hub" : "Callbox Davao Site Directory"}
                        </span>
                        <h2 className="text-5xl sm:text-6xl font-black tracking-tighter italic uppercase leading-none text-white font-display">
                          {currentUser?.role === "inactive" ? <>Inactive<br/>Resources</> : <>Latest<br/>Updates</>}
                        </h2>
                      </div>
                      
                      {currentUser?.role === "inactive" ? (
                        <div className="border border-teal-500/20 rounded-xl p-4 bg-[#0a0a0a] max-w-sm text-left font-accent">
                          <div className="flex gap-2.5 items-start">
                            <Eye className="w-4.5 h-4.5 shrink-0 text-teal-400 mt-0.5 animate-pulse" />
                            <div>
                              <p className="font-bold uppercase tracking-wider text-[10px] text-teal-400">Read-Only Gateway Verified</p>
                              <p className="text-[10px] text-zinc-400 leading-normal mt-1 font-sans">
                                You are viewing external, general directories and onboarding indices explicitly white-flagged by Davao Site Admin.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-left md:text-right font-accent">
                          <p className="text-xs text-white/40 tracking-widest uppercase">Davao, Philippines</p>
                          <p className="text-xl font-mono tracking-widest text-white glow-text-gold">{timeStr}</p>
                          <p className="text-[10px] text-zinc-500 font-mono italic tracking-wide mt-0.5">{dateStr}</p>
                        </div>
                      )}
                    </div>

                    {/* Quick collapsible client submission portal inside primary feed area */}
                    <AnimatePresence>
                      {false && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, scale: 0.98 }}
                          animate={{ opacity: 1, height: "auto", scale: 1 }}
                          exit={{ opacity: 0, height: 0, scale: 0.98 }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 rounded-2xl border border-[#ffaa00]/20 bg-[#0a0a0a]/90 relative glass-panel-glow mb-2">
                            <span className="absolute top-4 right-4 text-[9px] uppercase tracking-widest text-[#ffaa00] border border-[#ffaa00]/25 bg-[#ffaa00]/5 px-2 py-0.5 rounded font-bold font-mono">
                              Author Publish State
                            </span>
                            
                            <div className="max-w-xl">
                              <h3 className="text-sm uppercase tracking-wider text-white font-accent font-extrabold flex items-center gap-1.5 mb-1">
                                <Plus className="w-4 h-4 text-[#ffaa00]" />
                                Index New External Link
                              </h3>
                              <p className="text-[11px] text-zinc-400 mb-5 leading-relaxed">
                                Personnel with logged-in @callboxinc.com credentials can insert resources. It will broadcast to all registered employees immediately.
                              </p>

                              <form onSubmit={handleAddLink} className="space-y-4 text-left">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-accent font-bold">Resource Title *</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="Identify target system"
                                      value={linkForm.title}
                                      onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                                      className="w-full h-10 bg-zinc-900 border border-white/10 rounded-lg px-3.5 text-xs text-white focus:outline-none focus:border-[#ffaa00] font-sans"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-accent font-bold">Category Group *</label>
                                    <select
                                      value={linkForm.category}
                                      onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })}
                                      className="w-full h-10 bg-zinc-900 border border-white/10 rounded-lg px-3 text-xs text-zinc-100 focus:outline-none focus:border-[#ffaa00] font-sans"
                                    >
                                      <option value="Campaigns">Campaigns</option>
                                      <option value="Operations">Operations</option>
                                      <option value="HR & Benefits">HR & Benefits</option>
                                      <option value="IT Support">IT Support</option>
                                      <option value="Training">Training</option>
                                      <option value="General">General</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-accent font-bold font-semibold">Web URL Address *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. portal.callboxinc.com"
                                    value={linkForm.url}
                                    onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                                    className="w-full h-10 bg-zinc-900 border border-white/10 rounded-lg px-3.5 text-xs text-white focus:outline-none focus:border-[#ffaa00] font-sans"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-accent font-bold">Brief process details / Instructions</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Requires corporate VPN or single-sign-on credentials."
                                    value={linkForm.description}
                                    onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                                    className="w-full h-10 bg-zinc-900 border border-white/10 rounded-lg px-3.5 text-xs text-white focus:outline-none focus:border-[#ffaa00]"
                                  />
                                </div>

                                <div className="flex gap-2 pt-1.5 text-xs">
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    type="submit"
                                    disabled={isSubmittingLink}
                                    className="h-10 px-5 bg-[#ffaa00] hover:bg-[#ffaa00]/90 text-black font-extrabold uppercase tracking-wider text-[11px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    {isSubmittingLink ? "Broadcasting..." : "Confirm Publication"}
                                    <Send className="w-3.5 h-3.5" />
                                  </motion.button>
                                  
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={() => setLinkFormOpen(false)}
                                    className="h-10 px-4 bg-zinc-900 hover:bg-zinc-805 border border-white/5 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </motion.button>
                                </div>
                              </form>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Filters, query indexer, and search panel */}
                    <div className="p-4 rounded-xl border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 glow-box">
                      
                      {/* Search bar inside feeds */}
                      <div className="relative w-full md:max-w-xs">
                        <input
                          type="text"
                          placeholder="Search links..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-10 bg-zinc-900/50 rounded-lg border border-white/10 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#ffaa00] transition-all font-sans"
                        />
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3.5" />
                      </div>

                      {/* Micro inline categories filter list */}
                      <div className="flex flex-wrap gap-1.5 justify-start md:justify-end w-full md:w-auto">
                        {["All", "Campaigns", "Operations", "HR & Benefits", "IT Support", "Training"].map(cat => (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all font-bold cursor-pointer border ${
                              categoryFilter === cat 
                                ? "bg-[#ffaa00] text-black border-[#ffaa00]" 
                                : "bg-zinc-900/35 text-zinc-400 border-white/5 hover:text-white hover:border-white/10"
                            }`}
                          >
                            {cat}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Awwwards Design Style Link grid view */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6">
                      
                      {filteredLinks.length === 0 ? (
                        <div className="col-span-full text-center py-20 border border-dashed border-white/10 rounded-2xl p-8 bg-zinc-950/20 glow-box">
                          <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-4 text-zinc-500">
                            <Plus className="w-6 h-6" />
                          </div>
                          <p className="text-xs uppercase tracking-[0.2em] text-white/40 font-accent font-bold">No Records Found</p>
                          <p className="text-xs italic text-zinc-500 mt-2">No resource matching "{searchQuery}" could be found.</p>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setCategoryFilter("All"); setSearchQuery(""); }}
                            className="mt-5 px-4 py-2 bg-zinc-900 border border-white/5 rounded-lg text-[10px] uppercase tracking-wider text-cyan-400 hover:text-white font-bold cursor-pointer transition-colors"
                          >
                            Reset filters
                          </motion.button>
                        </div>
                      ) : (
                        filteredLinks.map((link, idx) => (
                          <motion.div
                            key={link.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35, delay: Math.min(idx * 0.05, 0.4) }}
                            className="p-6 rounded-2xl border border-white/10 bg-[#0a0a0a]/90 flex flex-col justify-between group h-64 text-left glow-box"
                          >
                            <div>
                              {/* Index header mapping layout */}
                              <div className="flex justify-between items-start">
                                <span className="text-[11px] font-mono text-[#ffaa00] font-bold tracking-wide">
                                  {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                                </span>
                                
                                <span className="px-2 py-0.5 border border-white/10 rounded-full text-[8px] uppercase tracking-widest text-zinc-400 bg-white/5 font-bold">
                                  {link.category}
                                </span>
                              </div>

                              {/* Title with translate dynamic hover matching CSS instructions */}
                              <h3 className="text-2xl mt-4 font-light text-white font-display group-hover:translate-x-2 transition-transform duration-300 truncate tracking-tight pr-2">
                                {link.title}
                              </h3>
                              <p className="text-zinc-400 text-xs tracking-wide line-clamp-3 mt-2 leading-relaxed">
                                {link.description || "Instructional documentation and single sign-on variables are grandfathered securely."}
                              </p>
                            </div>

                            {/* Info footers */}
                            <div className="pt-4 mt-auto">
                              <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">
                                Added by: <span className="text-zinc-300 font-semibold">{link.addedBy ? link.addedBy.split('@')[0] : "System Admin"}</span>
                              </p>
                              
                              <div className="mt-4 flex flex-wrap gap-2 items-center text-[10px]">
                                <span className="text-zinc-600 font-mono tracking-tighter">internal-use-only</span>
                                <span className="text-zinc-600">/</span>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => copyToClipboard(link.url)}
                                  className="text-[10px] text-zinc-500 hover:text-white transition-colors cursor-pointer mr-auto underline decoration-dotted font-accent"
                                >
                                  copy url
                                </motion.button>
                                
                                <a 
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-[#ffaa00] hover:text-[#ffaa00]/100 hover:underline inline-flex items-center gap-1 font-bold italic tracking-wide cursor-pointer glow-text-gold"
                                >
                                  Launch Resource
                                  <ExternalLink className="w-3 h-3 text-[#ffaa00]" />
                                </a>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}

                      {/* Admin action card placeholder mimicking Design HTML layout */}
                      {currentUser?.role === "admin" && (
                        <div 
                          onClick={() => {
                            setIsAdminViewInPortal(true);
                          }}
                          className="border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 text-center hover:border-[#ffaa00]/40 group transition-all cursor-pointer bg-zinc-950/10 min-h-64"
                        >
                          <div className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center mb-4 group-hover:bg-[#ffaa00]/10 group-hover:border-[#ffaa00] transition-all">
                            <Plus className="text-[#ffaa00] text-xl font-light w-5 h-5 group-hover:scale-110 transition-transform" />
                          </div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-accent font-extrabold group-hover:text-white transition-colors">
                            Systems Console Command
                          </p>
                          <p className="text-xs italic text-zinc-500 mt-2 font-accent">
                            Open Method 1 and Method 2 control desk
                          </p>
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corporate Design footer from design spec */}
      <footer className="w-full mt-auto max-w-[1400px] mx-auto px-6 pt-10 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-zinc-600 relative z-10 font-sans">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-center text-center sm:text-left">
          <div className="text-[9px] uppercase tracking-widest flex items-center gap-2">
            <span className="text-white/30">System Status:</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ffcc]" />
            <span className="text-[#00ffcc] font-bold italic">Operational</span>
          </div>
          <div className="text-[9px] uppercase tracking-widest hidden md:block">
            <span className="text-white/30">Registered Domain limits:</span>
            <span className="text-white/80 font-bold ml-1.5">@callboxinc.com active whitelist</span>
          </div>
        </div>
        <div className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-accent text-center sm:text-right font-medium">
          Internal Use Only • Callbox Davao Portal v2.6.5
        </div>
      </footer>
    </div>
  );
}
