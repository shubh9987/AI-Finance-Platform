import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { LayoutDashboard, LogIn, LogOut, PenBox } from "lucide-react";

import { Button } from "./ui/button";

const Header = async () => {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token");

  const isAuthenticated = Boolean(authToken?.value);

  return (
    <div className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <Image
            src="/logo.png"
            alt="welth logo"
            height={60}
            width={200}
            className="h-12 w-auto object-contain"
          />
        </Link>

        {/* Navigation */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-blue-600 flex items-center gap-2"
              >
                <Button variant="outline">
                  <LayoutDashboard size={18} />
                  <span className="hidden md:inline">Dashboard</span>
                </Button>
              </Link>

              {/* Add Transaction */}
              <Link href="/transaction/create">
                <Button className="flex items-center gap-2">
                  <PenBox size={18} />
                  <span className="hidden md:inline">
                    Add Transaction
                  </span>
                </Button>
              </Link>

              {/* Logout */}
              <form action="/api/logout" method="POST">
                <Button
                  type="submit"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <LogOut size={18} />
                  <span className="hidden md:inline">Logout</span>
                </Button>
              </form>
            </>
          ) : (
            /* Login */
            <Link href="/sign-in">
              <Button variant="outline" className="flex items-center gap-2">
                <LogIn size={18} />
                Login
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Header;
