import { PageHeader, PageShell } from '@/components/ui/chrome';

export default function NotFound() {
    return (
        <PageShell>
            <PageHeader title="404" subtitle="This page could not be found." />
        </PageShell>
    );
}
