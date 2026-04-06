import { useEffect, useMemo, useState } from 'react';
import { getCurriculumCatalog } from '../api';
import { NCERT_CHAPTERS } from '../constants/ncert';

type CurriculumCatalog = Record<string, Record<string, string[]>>;

export const useCurriculumCatalog = (classNum: string) => {
    const [remoteCatalog, setRemoteCatalog] = useState<CurriculumCatalog>({});

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await getCurriculumCatalog();
                if (active && response?.catalog) {
                    setRemoteCatalog(response.catalog);
                }
            } catch {
                // Keep local fallback if API is unavailable.
            }
        };
        load();
        return () => {
            active = false;
        };
    }, []);

    const catalog = useMemo<CurriculumCatalog>(() => {
        return Object.keys(remoteCatalog).length ? remoteCatalog : NCERT_CHAPTERS;
    }, [remoteCatalog]);

    const subjectsForClass = useMemo(() => {
        return Object.keys(catalog[classNum] || {});
    }, [catalog, classNum]);

    const chaptersForSubject = (subject: string) => {
        return catalog[classNum]?.[subject] || [];
    };

    return {
        catalog,
        subjectsForClass,
        chaptersForSubject,
    };
};
