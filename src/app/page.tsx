'use client';

import MathpixEditor from "@/components/MathpixEditor";


export default function Home() {
  const handleSave = (updatedContent: string) => {
    console.log('Saving updated content:', updatedContent);
    
  };

  return (
    <main>
      <MathpixEditor 
        mmdFilePath="/manual.mmd"
        onSave={handleSave}
      />
    </main>
  );
}
