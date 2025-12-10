import React, { useState, useEffect } from "react";
import { NextPage } from "next";
import { OpenGraph } from "@/components/other/OpenGraph";
import { PasswordGate } from "@/components/admin/PasswordGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import {
  getAdminPasswordFromCookie,
  setAdminPasswordCookie,
  clearAdminPasswordCookie,
} from "@/utils/auth";

const AdminPage: NextPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on mount
  useEffect(() => {
    const apiKey = getAdminPasswordFromCookie();
    if (apiKey) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Set body attribute to hide wallet components
  useEffect(() => {
    document.body.setAttribute("data-admin-page", "true");
    return () => {
      document.body.removeAttribute("data-admin-page");
    };
  }, []);

  // Hard refresh when navigating to the page (not on initial page load)
  useEffect(() => {
    // Check if this is a navigation from another page (not a hard refresh)
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

    if (navigation && navigation.type === "navigate") {
      // This is a navigation from another page, force a hard refresh
      console.log("[ADMIN PAGE] Navigation detected, forcing hard refresh...");
      window.location.reload();
    }
  }, []);

  // Track tab visibility and auto-refresh if inactive for more than 5 minutes
  useEffect(() => {
    let lastVisibleTime = Date.now();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden, store the current time
        lastVisibleTime = Date.now();
      } else {
        // Tab became visible, check if more than 5 minutes have passed
        const timeAway = Date.now() - lastVisibleTime;
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

        if (timeAway > fiveMinutes) {
          console.log(
            `[ADMIN PAGE] Tab was inactive for ${Math.round(timeAway / 1000 / 60)} minutes. Auto-refreshing...`
          );
          window.location.reload();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleAuthenticated = (password: string) => {
    setAdminPasswordCookie(password);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAdminPasswordCookie();
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <>
      <OpenGraph
        title="RIFT - Admin Panel"
        description="Administrative dashboard for RIFT protocol"
        embed={{ image: "/images/PreviewArt.png" }}
      />

      {isAuthenticated ? (
        <AdminDashboard onLogout={handleLogout} />
      ) : (
        <PasswordGate onAuthenticated={handleAuthenticated} />
      )}
    </>
  );
};

export default AdminPage;
