import type { ReactNode } from 'react';

/**
 * The online admission Terms & Conditions, shared by the student-facing form
 * (app/admission/[id]) and the staff review page, so staff see exactly the
 * text the applicant acknowledged. Bump ADMISSION_TERMS_VERSION when the text
 * changes — it's stored with each submission.
 */
export const ADMISSION_TERMS_VERSION = '2026-11-03';

export interface AdmissionTermsSection {
  idx: number;
  title: string;
  icon: string;
  content: ReactNode;
}

export const ADMISSION_TERMS_SECTIONS: AdmissionTermsSection[] = [
  {
    idx: 0, title: 'Admission / Enrollment', icon: 'fa-user-check',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Admission is online only through our website (<a href="http://www.suvidya.ac.in" target="_blank" rel="noreferrer" className="text-[#2A6BB5] underline font-medium">www.suvidya.ac.in</a>).</li>
        <li>Candidates without any relevant qualification but having relevant design experience of more than 5 years shall be given admission on submission of experience letter (from the employer) / declaration.</li>
        <li>Admission shall be confirmed only after verification of all required documents and receipt of fees.</li>
      </ol>
    )
  },
  {
    idx: 1, title: 'Confirmation of Admission', icon: 'fa-envelope-open-text',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>A confirmation email will be sent to participant on receipt of full payment and successfully completed registration form one week prior to attending the Training Programme.</li>
        <li>Pre-Training Assignment with the details of the training program will be shared to the participant once the Admission is confirmed.</li>
        <li>For Out station Students – Once the Admission is confirmed, Participant to confirm their accommodation and Inform SIT well in advance. If required SIT shall support for the Accommodation.</li>
        <li>Out station Participants to reach Mumbai 1 or 2 days before the batch starts.</li>
        <li>100% fees in advance have to be done before commencement of the batch.</li>
      </ol>
    )
  },
  {
    idx: 2, title: 'Payment', icon: 'fa-credit-card',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>100% fees in advance through online transfer.</li>
        <li>Demand Draft/NEFT of any bank in favor of &apos;Suvidya Institute of Technology Pvt. Ltd.&apos; payable at Mumbai.</li>
        <li>Penalty of Rs 500/- will be charged towards bank charges in case of Cheque returned.</li>
        <li>Payment may be made thru NEFT transfer, accounts details are as under:
          <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-xs space-y-1.5">
            {[['Bank account name','Suvidya Institute of Technology Pvt. Ltd.'],['Bank Name','Axis Bank Ltd.'],['Branch Address','Vakola, Mumbai (MH), City Survey No. 841 to 846, Florence Lorenace Chs. Ltd. Mumbai 400055.'],['IFSC code for NEFT','UTIB0001244'],['MICR Code','400211082'],['Bank Account No.','911020002988600']].map(([k,v])=>(
              <div key={k} className="flex flex-col sm:flex-row sm:gap-2"><span className="font-semibold text-gray-700 sm:w-36 sm:flex-shrink-0">{k}</span><span className="text-gray-600"><span className="hidden sm:inline">: </span>{v}</span></div>
            ))}
          </div>
        </li>
      </ol>
    )
  },
  {
    idx: 3, title: 'Offline / Inhouse Lectures', icon: 'fa-chalkboard-teacher',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Lectures will be conducted in SIT premises.</li>
        <li>Learners should reach the Institute 15 mins before the lecture time.</li>
        <li>Dress code will be applicable (Sky blue color shirt / black or blue navy pant).</li>
      </ol>
    )
  },
  {
    idx: 4, title: 'Online Lectures', icon: 'fa-video',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Google Meet / Zoom App to be installed in your mobile phone or laptop.</li>
        <li>Meeting link / ID &amp; password for the lecture will be shared on WhatsApp / E-mail well in advance.</li>
        <li>Before joining the session, you need to update your proper name.</li>
        <li>Participants should join the session 10 Minutes before the actual time.</li>
        <li>Participants are free to ask or share any queries related to the topic on the same day.</li>
        <li>The video camera must be on during the whole session.</li>
        <li>International candidates are requested to log in as per the Indian Standard time.</li>
      </ol>
    )
  },
  {
    idx: 5, title: 'Admission Transfer', icon: 'fa-exchange-alt',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Admission transfer fees:<ul className="list-[lower-alpha] ml-5 mt-1 space-y-1"><li>Up to last day of admission: Nil</li><li>After the last date of admission &amp; one day prior to start of Training: 10% of Total fees</li><li>On the first day of Training and onwards: 20% of Total fees</li></ul></li>
        <li>Admissions are strictly non-transferable in any other name and for any other Training Program.</li>
        <li>Admission will be transferred only on receipt of Admission Transfer-Cancellation Form.</li>
        <li>Transfer will be allowed only up to two consecutive batches.</li>
        <li>In case of transfer it is compulsory to attend the new batch from day one; unit test, assignment, attendance of previous batch will not be considered.</li>
      </ol>
    )
  },
  {
    idx: 6, title: 'Admission Cancellation', icon: 'fa-ban',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Admission Cancellation charges:<ul className="list-[lower-alpha] ml-5 mt-1 space-y-1"><li>Up to last date of admission: 30% of the Total fees.</li><li>After last date &amp; one day prior to start: 50% of the Total fees.</li><li>On the first day of commencement: No Refunds.</li></ul></li>
        <li>Admission will be cancelled only on receipt of Admission Transfer-Cancellation Form.</li>
        <li>Admission shall be cancelled where students fail to attend first three lectures or fail to inform for absenteeism.</li>
      </ol>
    )
  },
  {
    idx: 7, title: 'Final Examination', icon: 'fa-file-alt',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Students only with and above 75% attendance will be eligible for the final examination.</li>
        <li>Students unable to appear for the examination shall inform the Training Co-ordinator.</li>
        <li>Grade is based on average score. <span className="font-semibold text-gray-700">Weightage: Unit Test – 35%, Assignment – 15%, Final Exam – 50%</span></li>
        <li>1% marks will be deducted for each un-disciplined behavior.</li>
        <li>Criteria of Grade:
          <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs bg-white border border-gray-200 rounded-lg p-2">
            {[['A+','90–100%'],['A','80–89.99%'],['B+','70–79.99%'],['B','60–69.99%'],['C','50–59.99%'],['No Cert.','≤49.99%']].map(([g,r])=>(
              <div key={g} className="flex items-center gap-1"><span className="font-bold text-[#2E3093]">{g}</span><span className="text-gray-500">{r}</span></div>
            ))}
          </div>
        </li>
      </ol>
    )
  },
  {
    idx: 8, title: 'Issue of Certificate', icon: 'fa-certificate',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Graduate Engineers will be awarded &apos;Post Graduate Diploma&apos; and Diploma holders with &apos;Post Diploma&apos; certificate.</li>
        <li>For all drafting training programme &apos;Diploma&apos; certificate will be awarded.</li>
        <li>For all software training &quot;Training in __(software name)&quot; certificate will be awarded.</li>
        <li>Candidates without qualification but with 5+ years design experience shall be awarded &apos;Diploma&apos;.</li>
        <li>Students shall collect certificates within one month of convocation.</li>
        <li>Certificate may be issued in absence of student only on submission of authority letter.</li>
        <li>Duplicate certificate stamped &apos;Duplicate&apos; may be issued on payment of Rs 1000/-.</li>
      </ol>
    )
  },
  {
    idx: 9, title: 'Participants Feedback', icon: 'fa-comment-dots',
    content: (
      <p className="text-gray-600">SIT would love to hear your questions, concerns, requirements, and feedback about our Services through mail or sending a recorded video on <a href="mailto:enquiry@suvidya.ac.in" className="text-[#2A6BB5] underline font-medium">enquiry@suvidya.ac.in</a>.</p>
    )
  },
  {
    idx: 10, title: 'General Rules & Regulations', icon: 'fa-gavel',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Students are required to complete the Training Program and appear for examination of the same batch.</li>
        <li>Any change in mobile number, email ID or postal address should be informed immediately.</li>
        <li>Full day lectures will be arranged looking at the need &amp; requirement, with advance information to all.</li>
        <li>All disputes / legal issues will be resolved after discussion with both parties.</li>
        <li>All disputes / legal issues will be subject to Mumbai jurisdiction.</li>
        <li>From time to time, we may update these Terms to clarify our practices.</li>
        <li>One full day absent will be marked for 3 late joining of sessions.</li>
        <li>Lectures will not be repeated once already conducted.</li>
        <li>Repeaters must confirm &amp; pay the applicable re-exam fees two weeks before the examination date.</li>
        <li>Students shall be allowed for re-exam only for next 2 attempts.</li>
        <li>Students failing in the 3rd attempt may apply for re-admission.</li>
        <li>Students appearing for re-exam will be entitled for &quot;C&quot; grade only.</li>
        <li>Stationery required: Scientific Calculator, Pen (Blue, Red, Green), Highlighter (Yellow), Pencil 0.5mm and Eraser.</li>
        <li>SIT shall provide training material during session in form of handouts wherever necessary.</li>
        <li>Additional charges of Rs 500 will be charged for additional copy of the training manual.</li>
        <li>With regards to any problem in attendance please contact Training Co-Ordinator immediately.</li>
        <li>Certificate of appreciation will be issued for 100% attendance with 3% grace marks.</li>
      </ol>
    )
  },
  {
    idx: 11, title: 'International Candidates', icon: 'fa-globe-asia',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>100% fees in advance through wire transfer only.</li>
        <li>During ongoing training, candidates are forbidden from taking admission elsewhere for any other course.</li>
        <li>Candidates to handover original passport to SIT for security purpose; returned on last day of the programme.</li>
        <li>If any special remarks on VISA document, candidate has to visit the Indian Embassy in Mumbai (If Required).</li>
        <li>Refund subject to Admission Cancellation conditions will be remitted through bank.</li>
        <li>&quot;Medium of Training / Instructions&quot; will be in English; candidate required to be thorough in English.</li>
      </ol>
    )
  },
  {
    idx: 12, title: 'Placement Assistance', icon: 'fa-briefcase',
    content: (
      <p className="text-gray-600">100% &apos;Placement Assistance&apos; will be provided only for Indian Students which will be as per company requirements and market conditions.</p>
    )
  },
  {
    idx: 13, title: 'Code of Conduct', icon: 'fa-user-shield',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Students are required to be highly punctual and regular in attending the lectures.</li>
        <li>Expected to follow formal wear as training will be with VIDEO on as and when required.</li>
        <li>Students to maintain utmost discipline &amp; utter silence during the Training.</li>
        <li>Students to be polite with SIT staff and all fellow students and shall avoid needless arguments.</li>
        <li>During visit to SIT, wearing the Identity Card and following rules in premises are mandatory.</li>
      </ol>
    )
  },
  {
    idx: 14, title: 'Copyrights', icon: 'fa-copyright',
    content: (
      <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
        <li>Copyright &copy; 2017 SIT. All Rights Reserved.</li>
        <li>You will not copy the training Manuals / Contents / Materials in any way whatsoever, distribute, download, display, reproduce, modify, edit, alter, enhance, broadcast or tamper with in any way.</li>
        <li>You will not remove any copyright, trademark or intellectual property notices from the original material without our express written consent.</li>
        <li>Unauthorized use of any contents may give rise to a claim for damages and/or be a criminal offence.</li>
        <li>Study material is for reference only. We don&apos;t sell our study material for Correspondence / Distance or Commercial Purposes.</li>
      </ol>
    )
  },
];

/** Notice shown before collecting personal data, per the Digital Personal Data Protection Act, 2023. */
export function DpdpNotice() {
  return (
    <div className="space-y-2 text-gray-600 text-xs leading-relaxed">
      <p>
        Suvidya Institute of Technology Pvt. Ltd. (&quot;SIT&quot;) is the Data Fiduciary for the personal data you give in this
        form, under the <span className="font-semibold text-gray-800">Digital Personal Data Protection Act, 2023 (DPDP Act)</span>.
      </p>
      <ul className="list-disc ml-5 space-y-1">
        <li><span className="font-semibold text-gray-700">What we collect:</span> your name, date of birth, contact details, family contact, addresses, Aadhaar number, photograph, academic records and marksheets, work experience, medical history (if you choose to share it) and payment details.</li>
        <li><span className="font-semibold text-gray-700">Why:</span> to process and verify your admission, run the training programme (attendance, examinations, certificates), collect fees, provide placement assistance, and meet legal and regulatory obligations (including NSDC / government reporting where applicable).</li>
        <li><span className="font-semibold text-gray-700">Who sees it:</span> authorised SIT staff only, and — where needed for the purposes above — government / skill-development bodies and prospective employers for placement. We do not sell your data.</li>
        <li><span className="font-semibold text-gray-700">How long:</span> for the duration of your training and as long as required for certificates, records and the law, after which it is deleted or anonymised.</li>
        <li><span className="font-semibold text-gray-700">Your rights:</span> you may ask to access, correct, update or erase your personal data, withdraw this consent, or raise a grievance by writing to <a href="mailto:enquiry@suvidya.ac.in" className="text-[#2A6BB5] underline font-medium">enquiry@suvidya.ac.in</a>. Withdrawing consent does not affect processing already done, but may mean we can no longer continue your admission. If unresolved, you may complain to the Data Protection Board of India.</li>
      </ul>
    </div>
  );
}

export const DPDP_CONSENT_STATEMENT =
  'I have read the data protection notice and give my free, specific and informed consent to SIT processing my personal data, including my Aadhaar number, for the purposes stated, under the Digital Personal Data Protection Act, 2023.';

/** The eligibility-exception declarations a candidate ticks (consentChecks[i] ↔ item i). */
export function consentDeclarationItems(trainingCategory?: string | null): string[] {
  return [
    `I am enrolling in the Training Program "${trainingCategory || '…'}" voluntarily and with full understanding of the Training Program structure, objectives, and outcomes.`,
    'I have been informed of the eligibility criteria and understand that my admission is being considered as an exception based on my interest, motivation, and willingness to learn.',
    'I take full responsibility for bridging any gaps in foundational knowledge and agree to put in the required effort to understand and complete the Training Program content effectively.',
    'On account of my educational background, I will be solely responsible for my training, performance, and placement.',
    'I confirm that I am joining the Training Program with a clear understanding of the above.',
  ];
}
