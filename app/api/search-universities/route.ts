import { NextRequest, NextResponse } from 'next/server';

// Comprehensive list of universities (can be expanded)
const UNIVERSITIES = [
  // Indian Universities - Maharashtra
  { name: 'University of Mumbai', country: 'India', city: 'Mumbai' },
  { name: 'Savitribai Phule Pune University (SPPU)', country: 'India', city: 'Pune' },
  { name: 'Narsee Monjee Institute of Management Studies (NMIMS)', country: 'India', city: 'Mumbai' },
  { name: 'Symbiosis International University', country: 'India', city: 'Pune' },
  { name: 'Shivaji University', country: 'India', city: 'Kolhapur' },
  { name: 'Dr. Babasaheb Ambedkar Marathwada University', country: 'India', city: 'Aurangabad' },
  { name: 'Sant Gadge Baba Amravati University', country: 'India', city: 'Amravati' },
  { name: 'Rashtrasant Tukadoji Maharaj Nagpur University', country: 'India', city: 'Nagpur' },
  { name: 'Maharashtra State Board of Technical Education (MSBTE)', country: 'India', city: 'Mumbai' },
  
  // IITs
  { name: 'Indian Institute of Technology (IIT) Bombay', country: 'India', city: 'Mumbai' },
  { name: 'Indian Institute of Technology (IIT) Delhi', country: 'India', city: 'Delhi' },
  { name: 'Indian Institute of Technology (IIT) Madras', country: 'India', city: 'Chennai' },
  { name: 'Indian Institute of Technology (IIT) Kanpur', country: 'India', city: 'Kanpur' },
  { name: 'Indian Institute of Technology (IIT) Kharagpur', country: 'India', city: 'Kharagpur' },
  { name: 'Indian Institute of Technology (IIT) Roorkee', country: 'India', city: 'Roorkee' },
  { name: 'Indian Institute of Technology (IIT) Guwahati', country: 'India', city: 'Guwahati' },
  { name: 'Indian Institute of Technology (IIT) Hyderabad', country: 'India', city: 'Hyderabad' },
  
  // NITs
  { name: 'National Institute of Technology (NIT) Trichy', country: 'India', city: 'Tiruchirappalli' },
  { name: 'National Institute of Technology (NIT) Warangal', country: 'India', city: 'Warangal' },
  { name: 'National Institute of Technology (NIT) Surathkal', country: 'India', city: 'Mangalore' },
  { name: 'Visvesvaraya National Institute of Technology (VNIT)', country: 'India', city: 'Nagpur' },
  
  // Other Major Universities
  { name: 'University of Delhi', country: 'India', city: 'Delhi' },
  { name: 'Jawaharlal Nehru University', country: 'India', city: 'Delhi' },
  { name: 'Banaras Hindu University', country: 'India', city: 'Varanasi' },
  { name: 'Anna University', country: 'India', city: 'Chennai' },
  { name: 'University of Calcutta', country: 'India', city: 'Kolkata' },
  { name: 'Jadavpur University', country: 'India', city: 'Kolkata' },
  { name: 'Bangalore University', country: 'India', city: 'Bangalore' },
  { name: 'Osmania University', country: 'India', city: 'Hyderabad' },
  { name: 'Andhra University', country: 'India', city: 'Visakhapatnam' },
  { name: 'University of Madras', country: 'India', city: 'Chennai' },
  { name: 'Aligarh Muslim University', country: 'India', city: 'Aligarh' },
  { name: 'Jamia Millia Islamia', country: 'India', city: 'Delhi' },
  
  // Technical Universities
  { name: 'Dr. A.P.J. Abdul Kalam Technical University', country: 'India', city: 'Lucknow' },
  { name: 'Gujarat Technological University', country: 'India', city: 'Ahmedabad' },
  { name: 'Rajasthan Technical University', country: 'India', city: 'Kota' },
  { name: 'Dr. Babasaheb Ambedkar Technological University', country: 'India', city: 'Lonere' },
  { name: 'Visvesvaraya Technological University', country: 'India', city: 'Belgaum' },
  
  // Management Institutes
  { name: 'Indian Institute of Management (IIM) Ahmedabad', country: 'India', city: 'Ahmedabad' },
  { name: 'Indian Institute of Management (IIM) Bangalore', country: 'India', city: 'Bangalore' },
  { name: 'Indian Institute of Management (IIM) Calcutta', country: 'India', city: 'Kolkata' },
  { name: 'Indian Institute of Management (IIM) Lucknow', country: 'India', city: 'Lucknow' },
  { name: 'XLRI Xavier School of Management', country: 'India', city: 'Jamshedpur' },
  
  // Private Universities
  { name: 'Birla Institute of Technology and Science (BITS) Pilani', country: 'India', city: 'Pilani' },
  { name: 'Manipal Academy of Higher Education', country: 'India', city: 'Manipal' },
  { name: 'Vellore Institute of Technology (VIT)', country: 'India', city: 'Vellore' },
  { name: 'SRM Institute of Science and Technology', country: 'India', city: 'Chennai' },
  { name: 'Amity University', country: 'India', city: 'Noida' },
  { name: 'Lovely Professional University', country: 'India', city: 'Phagwara' },
  
  // Engineering Colleges - Maharashtra
  { name: 'Veermata Jijabai Technological Institute (VJTI)', country: 'India', city: 'Mumbai' },
  { name: 'College of Engineering, Pune (COEP)', country: 'India', city: 'Pune' },
  { name: 'Sardar Patel Institute of Technology (SPIT)', country: 'India', city: 'Mumbai' },
  { name: 'K. J. Somaiya College of Engineering', country: 'India', city: 'Mumbai' },
  { name: 'Walchand College of Engineering', country: 'India', city: 'Sangli' },
  { name: 'Government College of Engineering, Aurangabad', country: 'India', city: 'Aurangabad' },
  { name: 'Vishwakarma Institute of Technology (VIT)', country: 'India', city: 'Pune' },
  { name: 'Maharashtra Institute of Technology (MIT)', country: 'India', city: 'Pune' },
  { name: 'Thakur College of Engineering and Technology', country: 'India', city: 'Mumbai' },
  { name: 'Pillai College of Engineering', country: 'India', city: 'Navi Mumbai' },
  { name: 'Fr. Conceicao Rodrigues College of Engineering', country: 'India', city: 'Mumbai' },
  { name: 'Thadomal Shahani Engineering College', country: 'India', city: 'Mumbai' },
  
  // Polytechnics & Diploma Institutes - Maharashtra
  { name: 'Government Polytechnic, Mumbai', country: 'India', city: 'Mumbai' },
  { name: 'Vidyalankar Polytechnic', country: 'India', city: 'Mumbai' },
  { name: 'K. J. Somaiya Polytechnic', country: 'India', city: 'Mumbai' },
  { name: 'Government Polytechnic, Pune', country: 'India', city: 'Pune' },
  { name: 'Bharati Vidyapeeth Polytechnic', country: 'India', city: 'Pune' },
  { name: 'AIKTC Polytechnic', country: 'India', city: 'Navi Mumbai' },
  { name: 'Anjuman-I-Islam Polytechnic', country: 'India', city: 'Mumbai' },
  { name: 'Vivekanand Education Society Polytechnic', country: 'India', city: 'Mumbai' },
  
  // ITI & Vocational Training Institutes
  { name: 'Government ITI, Mumbai', country: 'India', city: 'Mumbai' },
  { name: 'Government ITI, Pune', country: 'India', city: 'Pune' },
  { name: 'National Skill Development Corporation (NSDC)', country: 'India', city: 'New Delhi' },
  { name: 'Central Training Institute for Instructors (CTTI)', country: 'India', city: 'Mumbai' },
  { name: 'Industrial Training Institute, Nagpur', country: 'India', city: 'Nagpur' },
  { name: 'Government Tool Room & Training Centre', country: 'India', city: 'Mumbai' },
  
  // Commerce & Arts Colleges - Maharashtra
  { name: 'Sydenham College of Commerce and Economics', country: 'India', city: 'Mumbai' },
  { name: 'H.R. College of Commerce and Economics', country: 'India', city: 'Mumbai' },
  { name: 'Jai Hind College', country: 'India', city: 'Mumbai' },
  { name: 'St. Xavier\'s College, Mumbai', country: 'India', city: 'Mumbai' },
  { name: 'Fergusson College', country: 'India', city: 'Pune' },
  { name: 'Modern College of Arts, Science and Commerce', country: 'India', city: 'Pune' },
  { name: 'Wilson College', country: 'India', city: 'Mumbai' },
  { name: 'Mithibai College', country: 'India', city: 'Mumbai' },
  { name: 'R. A. Podar College of Commerce and Economics', country: 'India', city: 'Mumbai' },
  { name: 'K. J. Somaiya College of Arts and Commerce', country: 'India', city: 'Mumbai' },
  { name: 'Ramnarain Ruia College', country: 'India', city: 'Mumbai' },
  { name: 'Smt. M. M. P. Shah Women\'s College', country: 'India', city: 'Mumbai' },
  
  // Science Colleges - Maharashtra
  { name: 'Institute of Chemical Technology (ICT)', country: 'India', city: 'Mumbai' },
  { name: 'Royal Institute of Science', country: 'India', city: 'Mumbai' },
  { name: 'Kirti M. Doongursee College', country: 'India', city: 'Mumbai' },
  { name: 'Kelkar Education Trust\'s V. G. Vaze College', country: 'India', city: 'Mumbai' },
  { name: 'D. G. Ruparel College', country: 'India', city: 'Mumbai' },
  { name: 'National College', country: 'India', city: 'Mumbai' },
  
  // Other Engineering Colleges (Other States)
  { name: 'Delhi Technological University (DTU)', country: 'India', city: 'Delhi' },
  { name: 'Netaji Subhas Institute of Technology (NSIT)', country: 'India', city: 'Delhi' },
  { name: 'BMS College of Engineering', country: 'India', city: 'Bangalore' },
  { name: 'RV College of Engineering', country: 'India', city: 'Bangalore' },
  { name: 'PSG College of Technology', country: 'India', city: 'Coimbatore' },
  { name: 'Thapar Institute of Engineering and Technology', country: 'India', city: 'Patiala' },
  { name: 'Birla Institute of Technology (BIT)', country: 'India', city: 'Ranchi' },
  { name: 'Coimbatore Institute of Technology', country: 'India', city: 'Coimbatore' },
  
  // State Universities (Other States)
  { name: 'Punjab University', country: 'India', city: 'Chandigarh' },
  { name: 'Gujarat University', country: 'India', city: 'Ahmedabad' },
  { name: 'Maharaja Sayajirao University of Baroda', country: 'India', city: 'Vadodara' },
  { name: 'Kerala University', country: 'India', city: 'Thiruvananthapuram' },
  { name: 'Cochin University of Science and Technology', country: 'India', city: 'Kochi' },
  { name: 'University of Kerala', country: 'India', city: 'Thiruvananthapuram' },
  { name: 'Sardar Patel University', country: 'India', city: 'Anand' },
  { name: 'North Maharashtra University', country: 'India', city: 'Jalgaon' },
  { name: 'Solapur University', country: 'India', city: 'Solapur' },
  
  // Open Universities
  { name: 'Indira Gandhi National Open University (IGNOU)', country: 'India', city: 'New Delhi' },
  { name: 'Dr. B.R. Ambedkar Open University', country: 'India', city: 'Hyderabad' },
  { name: 'Yashwantrao Chavan Maharashtra Open University', country: 'India', city: 'Nashik' },
  
  // Architecture & Design Institutes
  { name: 'Sir J.J. College of Architecture', country: 'India', city: 'Mumbai' },
  { name: 'School of Planning and Architecture (SPA)', country: 'India', city: 'Delhi' },
  { name: 'National Institute of Design (NID)', country: 'India', city: 'Ahmedabad' },
  { name: 'Academy of Architecture, Mumbai', country: 'India', city: 'Mumbai' },
  
  // International Universities (Popular)
  { name: 'Harvard University', country: 'USA', city: 'Cambridge' },
  { name: 'Stanford University', country: 'USA', city: 'Stanford' },
  { name: 'Massachusetts Institute of Technology (MIT)', country: 'USA', city: 'Cambridge' },
  { name: 'University of Oxford', country: 'UK', city: 'Oxford' },
  { name: 'University of Cambridge', country: 'UK', city: 'Cambridge' },
  { name: 'California Institute of Technology (Caltech)', country: 'USA', city: 'Pasadena' },
  { name: 'University of California, Berkeley', country: 'USA', city: 'Berkeley' },
  { name: 'Yale University', country: 'USA', city: 'New Haven' },
  { name: 'Princeton University', country: 'USA', city: 'Princeton' },
  { name: 'Columbia University', country: 'USA', city: 'New York' },
  { name: 'University of Toronto', country: 'Canada', city: 'Toronto' },
  { name: 'University of Melbourne', country: 'Australia', city: 'Melbourne' },
  { name: 'National University of Singapore', country: 'Singapore', city: 'Singapore' },
  { name: 'Nanyang Technological University', country: 'Singapore', city: 'Singapore' },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ universities: [], success: true });
    }

    // Search in local database
    const searchTerm = query.toLowerCase();
    const filtered = UNIVERSITIES.filter(u =>
      u.name.toLowerCase().includes(searchTerm) ||
      u.city.toLowerCase().includes(searchTerm) ||
      u.country.toLowerCase().includes(searchTerm)
    ).slice(0, 20);

    return NextResponse.json({ universities: filtered, success: true });
  } catch (error) {
    console.error('University search error:', error);
    return NextResponse.json(
      { error: 'Failed to search universities', universities: [], success: false },
      { status: 500 }
    );
  }
}
