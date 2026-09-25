export type ExhibitionReference = {
  src: string;
  alt: string;
  caption?: string;
};

export type ExhibitionRecord = {
  slug: string;
  year: string;
  title: string;
  venue: string;
  city: string;
  context: string;
  references: ExhibitionReference[];
};

export const exhibitionRecords: ExhibitionRecord[] = [
  { slug: 'inspiring-minds-2023', year: '2023', title: 'Inspiring Minds', venue: 'Thought Pyramid', city: 'Wuse, Abuja', context: 'Group exhibition presented by the Embassy of Spain.', references: [] },
  { slug: 'gelede-comes-2023', year: '2023', title: 'GELEDE COMES', venue: 'Yaba Art Museum', city: 'Lagos, Nigeria', context: 'Group exhibition presented by Yaba Art Museum.', references: [] },
  { slug: 'visual-energy-2023', year: '2023', title: 'Visual Energy', venue: 'Shodex Art Gallery', city: 'Lagos, Nigeria', context: 'Group exhibition presented by Shodex Art Gallery.', references: [] },
  { slug: 'totalenergies-open-house-2023', year: '2023', title: 'TotalEnergies Open House Exhibition', venue: 'TotalEnergies', city: 'Lagos, Nigeria', context: 'Open House exhibition.', references: [] },
  { slug: 'fix-it-2023', year: '2023', title: 'FIX IT', venue: 'Thought Pyramid', city: 'Lagos, Nigeria', context: 'Group exhibition for the Life In My City Art Festival (LIMCAF).', references: [] },
  { slug: 'life-art-and-nature-2023', year: '2023', title: 'Life, Art, and Nature', venue: 'Shodex Art Gallery', city: 'Lagos, Nigeria', context: 'Group exhibition presented by Shodex Art Gallery.', references: [] },
  { slug: 'totalenergies-open-house-2022', year: '2022', title: 'TotalEnergies Open House Exhibition', venue: 'TotalEnergies', city: 'Lagos, Nigeria', context: 'Open House exhibition.', references: [] },
  { slug: 'international-group-exhibition-2022', year: '2022', title: 'International Group Exhibition', venue: 'Disrupt.Art · Christie · NFT Media Labs · Schiff Insurance · Cincinnati Museum', city: 'International collaboration', context: 'A group exhibition co-sponsored by the participating organisations.', references: [] },
];

export const workshopRecords = [
  { year: '2023', title: 'Body Culture', detail: 'Annual Performance Art Intensive Workshop at Yaba Art Museum, School of Art, Design and Printing, Yaba College of Technology, Lagos.' },
  { year: '2023', title: 'Installation Workshop with Peter Okotor', detail: 'Participant in the workshop held at Yaba Art Museum, Yaba College of Technology, Lagos.' },
  { year: '2023', title: 'The Currency', detail: 'Participant with Elom20ce, Musquiqui Chihying, Gregor Kasper and Eva Kwame as part of The Oceans and the Interpreters, organised by Centre for Contemporary Art Lagos, Yaba Art Museum, Crews Culture Foundation and Hong-Gah Museum, Taiwan.' },
  { year: '2023', title: 'How to Make Snail II', detail: 'Participant in Chang Enman’s workshop, supported by Temitayo Ogunbiyi, as part of The Oceans and the Interpreters.' },
  { year: '2023', title: 'The Resource Lab', detail: 'Participant in a workshop with Sogbesan Oluwatoyin, founder of Asa Heritage Foundation Africa.' },
];

export const professionalEngagements = [
  { year: '2023', title: 'Installation Team · Yusuf Grillo Museum', detail: 'Ikeja, Lagos, Nigeria.' },
  { year: '2023', title: 'Installation Team · GELEDE COMES', detail: 'Yaba Art Museum, Yaba, Lagos, Nigeria.' },
  { year: '2023', title: 'Installation Team · The Oceans and the Interpreters', detail: 'Centre for Contemporary Art Lagos, Yaba Art Museum, Crews Culture Foundation and Hong-Gah Museum, Taiwan.' },
  { year: '2020', title: 'Intern · Yaba Art Museum', detail: 'Yaba College of Technology, Lagos, Nigeria.' },
];

export function getExhibition(slug: string) {
  return exhibitionRecords.find((exhibition) => exhibition.slug === slug);
}
