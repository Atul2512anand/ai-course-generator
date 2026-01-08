import React, { forwardRef } from 'react';
import { Course } from '../types';

interface CertificateProps {
  course: Course;
  studentName: string;
  university: string;
}

export const Certificate = forwardRef<HTMLDivElement, CertificateProps>(({ course, studentName, university }, ref) => {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed left-[-9999px] top-0">
      <div
        ref={ref}
        className="w-[1123px] h-[794px] bg-white text-black p-12 border-[20px] border-double border-yellow-600 relative overflow-hidden flex flex-col items-center justify-center text-center font-serif"
        style={{
          backgroundImage: 'radial-gradient(circle at center, #fffff0 0%, #ffffff 100%)',
        }}
      >
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 border-b-4 border-r-4 border-yellow-600 rounded-br-full opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 border-t-4 border-l-4 border-yellow-600 rounded-tl-full opacity-50"></div>
        
        {/* Seal watermark */}
        <div className="absolute opacity-5 transform scale-150 pointer-events-none">
             <svg width="400" height="400" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
        </div>

        <div className="z-10 flex flex-col items-center w-full max-w-4xl space-y-8">
            <h1 className="text-6xl font-bold text-yellow-700 tracking-wide uppercase border-b-2 border-yellow-600 pb-4 px-12 mb-4">
                Certificate of Completion
            </h1>

            <p className="text-2xl text-gray-600 italic">This is to certify that</p>

            <h2 className="text-5xl font-bold text-gray-900 my-2 font-serif">{studentName || 'Student Name'}</h2>
            
            <p className="text-xl text-gray-500">{university ? `of ${university}` : ''}</p>

            <p className="text-2xl text-gray-600 italic mt-6">Has successfully completed the course</p>

            <h3 className="text-4xl font-bold text-blue-900 mt-2 max-w-3xl leading-tight">
                {course.title}
            </h3>
            
            <p className="text-xl text-gray-600 mt-4">
               Covering {course.modules.length} modules on {course.topic} ({course.level} Level).
            </p>

            <div className="flex justify-between w-full mt-16 px-20 items-end">
                <div className="flex flex-col items-center">
                    <span className="text-xl font-bold border-t border-gray-400 px-8 pt-2">{dateStr}</span>
                    <span className="text-sm text-gray-500 uppercase tracking-widest mt-1">Date</span>
                </div>

                <div className="flex flex-col items-center">
                   <div className="h-16 flex items-end justify-center">
                        <span className="font-cursive text-3xl text-blue-800" style={{fontFamily: 'cursive'}}>AI Generator</span>
                   </div>
                   <span className="text-xl font-bold border-t border-gray-400 px-8 pt-2">AI Course Generator</span>
                   <span className="text-sm text-gray-500 uppercase tracking-widest mt-1">Certified By</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
});

Certificate.displayName = "Certificate";
