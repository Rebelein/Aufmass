'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ListChecks, Settings } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Verwaltung</h1>
                    <p className="text-muted-foreground font-body">Wählen Sie einen Verwaltungsbereich aus.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Link href="/admin/aufmass">
                        <Card className="hover:shadow-lg hover:border-primary transition-all h-full">
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <ListChecks className="h-10 w-10 text-primary" />
                                    <div>
                                        <CardTitle className="font-headline">Aufmaß Verwaltung</CardTitle>
                                        <CardDescription className="font-body">Katalog, Artikel und Großhändler verwalten.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="font-body text-sm">Verwalten Sie hier alle Stammdaten für das Aufmaß-Modul.</p>
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/admin/anlagenbuch">
                        <Card className="hover:shadow-lg hover:border-primary transition-all h-full">
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <Settings className="h-10 w-10 text-primary" />
                                    <div>
                                        <CardTitle className="font-headline">Digitales Anlagenbuch Verwaltung</CardTitle>
                                        <CardDescription className="font-body">Protokolle, Einstellungen und Integrationen.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="font-body text-sm">Konfigurieren Sie hier die Einstellungen für das Anlagenbuch.</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>
        </div>
    )
}
