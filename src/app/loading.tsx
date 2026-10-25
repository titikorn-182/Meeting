export default function Loading() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="กำลังเปิดพื้นที่ทำงาน">
      <div className="skeleton h-10 w-64" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-96 w-full" />
    </div>
  );
}
