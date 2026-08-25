import { BrandingConfigurator } from "@/components/branding/branding-configurator";
import { ThemeConfigurator } from "@/components/theme/theme-configurator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ThemeDemoPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Theme & Branding Demo</h1>
        <p className="text-muted-foreground">Test and configure your theme and branding settings</p>
      </div>

      <Separator />

      {/* Theme Configuration */}
      <section>
        <ThemeConfigurator />
      </section>

      <Separator />

      {/* Branding Configuration */}
      <section>
        <BrandingConfigurator />
      </section>

      <Separator />

      {/* Component Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Component Showcase</h2>
          <p className="text-muted-foreground">
            See how all components look with your current theme and branding
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
              <CardDescription>Standard card appearance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">This is a regular card with default styling.</p>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>Primary Card</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Card with primary branding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-primary-foreground/90">
                This card uses the primary brand color.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-accent text-accent-foreground">
            <CardHeader>
              <CardTitle>Accent Card</CardTitle>
              <CardDescription className="text-accent-foreground/80">
                Card with accent color
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-accent-foreground/90">This card uses the accent color.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
