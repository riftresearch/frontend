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
